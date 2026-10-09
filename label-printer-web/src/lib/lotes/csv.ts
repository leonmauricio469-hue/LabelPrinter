import type { ProductRepository } from "@/lib/products/product.repository";
import { MAX_QTY_POR_TRABAJO } from "@/lib/validation/schemas";

/**
 * CSV de lotes (F5): parseo + resolucion contra el catalogo.
 *
 * Sin ERP, sin fuentes externas: cada fila se resuelve con el MISMO lookup que al
 * imprimir (`findByCode` y luego `findByBarcode`, igual que `POST /api/labels`), asi
 * que "resuelta" en el mapeo significa "imprimible", no "parecida". Lo que no esta en
 * el catalogo es fila con error, nunca una suposicion.
 *
 * El texto ya viene decodificado por el cliente (UTF-8 o Windows-1252 via
 * `TextDecoder`): aqui solo se parsea, no se adivina el encoding.
 */

export type CsvDelimiter = "," | ";";

export interface CsvTabla {
  delimiter: CsvDelimiter;
  /** Todas las filas con celdas, incluida la primera (el encabezado lo decide quien llama). */
  rows: string[][];
}

export interface MapeoColumnas {
  /** Indice de la columna con el codigo. */
  code: number;
  /** Indice de la columna con la cantidad, o `null` = sin columna (vale 1). */
  qty: number | null;
}

/**
 * Una fila ya resuelta contra el catalogo. `status: "ok"` aqui significa
 * "resuelta en el catalogo", NO "impresa": la impresion la decide el lote despues.
 */
export interface FilaPrevia {
  /** Numero de fila de datos (1-based, sin contar el encabezado). */
  n: number;
  rawCode: string;
  /** Codigo del catalogo cuando se resolvio; el crudo cuando no. */
  code: string;
  qty: number;
  name: string | null;
  status: "ok" | "error";
  error?: string;
}

/**
 * Adivina el delimitador contando comas y puntos y coma FUERA de comillas en las
 * primeras lineas no vacias. Empate o ninguno: coma (el CSV con una sola columna
 * no tiene delimitador y da igual cual se declare).
 */
export function detectarDelimitador(texto: string): CsvDelimiter {
  let comas = 0;
  let puntosYComas = 0;
  let vistas = 0;
  let entreComillas = false;
  for (const linea of texto.split(/\r\n|\r|\n/)) {
    if (linea.trim() === "") continue;
    if (++vistas > 5) break;
    for (let i = 0; i < linea.length; i++) {
      const c = linea[i];
      if (c === '"') {
        // Comilla escapada ("") dentro de comillas: no abre ni cierra.
        if (entreComillas && linea[i + 1] === '"') i++;
        else entreComillas = !entreComillas;
      } else if (!entreComillas && c === ",") {
        comas++;
      } else if (!entreComillas && c === ";") {
        puntosYComas++;
      }
    }
  }
  return puntosYComas > comas ? ";" : ",";
}

/**
 * Parsea CSV segun RFC 4180: comillas que encierran celdas con delimitadores o
 * saltos de linea, `""` como comilla literal, y `\r\n`, `\n` o `\r` como fin de
 * fila. Las lineas totalmente vacias se descartan (el salto final del archivo no
 * es una fila); una fila con celdas vacias SI se conserva, para que salga como
 * fila con error y no desaparezca en silencio.
 */
export function parseCsv(texto: string): CsvTabla {
  const delimiter = detectarDelimitador(texto);
  const rows: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;

  const cerrarCelda = () => {
    fila.push(celda);
    celda = "";
  };
  const cerrarFila = () => {
    cerrarCelda();
    // Descarta la linea vacia, conserva la fila con celdas vacias.
    if (!(fila.length === 1 && fila[0].trim() === "")) rows.push(fila);
    fila = [];
  };

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          celda += '"';
          i++;
        } else {
          entreComillas = false;
        }
      } else {
        celda += c;
      }
      continue;
    }
    if (c === '"') {
      entreComillas = true;
    } else if (c === delimiter) {
      cerrarCelda();
    } else if (c === "\r") {
      if (texto[i + 1] === "\n") i++;
      cerrarFila();
    } else if (c === "\n") {
      cerrarFila();
    } else {
      celda += c;
    }
  }
  // Ultima fila sin salto final. Sin esto, un CSV sin `\n` al final pierde su unica fila.
  if (entreComillas || celda !== "" || fila.length > 0) cerrarFila();

  return { delimiter, rows };
}

/**
 * Separa encabezado de datos. Con `tiene === true` la primera fila son los
 * nombres de columna; con `false` los nombres se generan ("Columna 1", ...) y
 * TODAS las filas son datos. No se adivina: lo decide el operador en la UI.
 */
export function conEncabezado(
  tabla: CsvTabla,
  tiene: boolean,
): { headers: string[]; records: string[][] } {
  if (!tiene || tabla.rows.length === 0) {
    const ancho = Math.max(0, ...tabla.rows.map((r) => r.length));
    return {
      headers: Array.from({ length: ancho }, (_, i) => `Columna ${i + 1}`),
      records: tabla.rows,
    };
  }
  return { headers: tabla.rows[0].map((h) => h.trim()), records: tabla.rows.slice(1) };
}

/** Adivina la columna de cantidad por el nombre del encabezado, o `null`. */
export function detectarColumnaCantidad(headers: string[]): number | null {
  const i = headers.findIndex((h) => /cant|cantidad|qty|quantity|qta/i.test(h));
  return i >= 0 ? i : null;
}

/**
 * Resuelve cada fila contra el catalogo con el mismo orden que al imprimir:
 * primero codigo interno, luego barcode. Un `catalog.json` corrupto no es "no
 * encontrado": se propaga como error de fila con el motivo, igual que el 500 de
 * la ruta de impresion.
 */
export async function resolverFilas(
  repo: ProductRepository,
  records: string[][],
  mapping: MapeoColumnas,
): Promise<FilaPrevia[]> {
  const filas: FilaPrevia[] = [];
  for (let i = 0; i < records.length; i++) {
    const n = i + 1;
    const celdas = records[i];
    const rawCode = (celdas[mapping.code] ?? "").trim();

    if (rawCode === "") {
      filas.push({ n, rawCode, code: rawCode, qty: 1, name: null, status: "error", error: `Fila ${n}: no trae codigo` });
      continue;
    }

    let qty = 1;
    if (mapping.qty !== null) {
      const crudo = (celdas[mapping.qty] ?? "").trim();
      if (crudo !== "") {
        if (!/^\d+$/.test(crudo)) {
          filas.push({
            n, rawCode, code: rawCode, qty: 1, name: null, status: "error",
            error: `Fila ${n}: la cantidad "${crudo}" no es un numero entero`,
          });
          continue;
        }
        qty = Number.parseInt(crudo, 10);
        if (qty < 1) {
          filas.push({
            n, rawCode, code: rawCode, qty: 1, name: null, status: "error",
            error: `Fila ${n}: la cantidad minima es 1`,
          });
          continue;
        }
        if (qty > MAX_QTY_POR_TRABAJO) {
          filas.push({
            n, rawCode, code: rawCode, qty, name: null, status: "error",
            error:
              `Fila ${n}: la cantidad maxima por trabajo es ${MAX_QTY_POR_TRABAJO} ` +
              `(por encima, el ZPL no cabe en la linea de comandos de Windows y la impresion falla sin dejar registro)`,
          });
          continue;
        }
      }
    }

    let producto;
    try {
      // El mismo lookup que `POST /api/labels`: el escaner entrega el barcode y
      // el operador a veces teclea el codigo interno. Que el mapeo diga "ok" y la
      // impresora saque otro producto seria el peor fallo posible.
      producto =
        (await repo.findByCode(rawCode)) ?? (await repo.findByBarcode(rawCode));
    } catch (err) {
      filas.push({
        n, rawCode, code: rawCode, qty, name: null, status: "error",
        error: `Fila ${n}: ${(err as Error).message}`,
      });
      continue;
    }

    if (!producto) {
      filas.push({
        n, rawCode, code: rawCode, qty, name: null, status: "error",
        error: `Codigo "${rawCode}" no esta en el catalogo`,
      });
      continue;
    }

    filas.push({ n, rawCode, code: producto.code, qty, name: producto.name, status: "ok" });
  }
  return filas;
}
