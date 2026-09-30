import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { productSchema } from "@/lib/validation/schemas";
import { ean13Problem, isEan13Shape } from "@/lib/labels/ean13";
import { describeJsonError, stripBom } from "@/lib/data/json-file";
import type { Product } from "./product.types";
import type { ProductRepository } from "./product.repository";

const DATA_DIR = path.resolve(process.cwd(), "data");
const CATALOG_FILE = path.join(DATA_DIR, "catalog.json");

/**
 * Normaliza un codigo para comparar.
 *
 * Se quita espacios y guiones y se pasa a minusculas porque el operador puede teclear
 * "7591234567890" o "759-12345-67890".
 *
 * Importante: los codigos se comparan **como texto**, nunca como numero. Un EAN-13
 * empieza por ceros a la izquierda y `parseInt("009300002509")` los perderia, dejando
 * el barcode de ese producto imposible de encontrar.
 */
function normalize(value: string): string {
  return value.replace(/[\s-]/g, "").toLowerCase();
}

/**
 * Cache por fecha de modificacion. `catalog.json` se edita a mano (y en la fase Carro
 * desde la web), asi que se comprueba el mtime en cada lectura: si el archivo cambio se
 * recarga, y si no se devuelve la copia en memoria. Evita releer y revalidar las miles
 * de filas del catalogo en cada escaneo.
 */
let cache: { mtimeMs: number; products: Product[] } | null = null;

async function load(): Promise<Product[]> {
  let mtimeMs: number;
  let raw: string;

  try {
    mtimeMs = (await fs.stat(CATALOG_FILE)).mtimeMs;
    if (cache && cache.mtimeMs === mtimeMs) return cache.products;
    raw = await fs.readFile(CATALOG_FILE, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  let parsed: unknown;
  try {
    // Sin `stripBom`, un `catalog.json` guardado desde Windows con BOM daria "no es JSON
    // valido" sin decir por que. Ver `json-file.ts`.
    parsed = JSON.parse(stripBom(raw));
  } catch (err) {
    throw new Error(describeJsonError("catalog.json", raw, err));
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`catalog.json debe ser un arreglo de productos, recibio ${typeof parsed}`);
  }

  const products: Product[] = [];
  const problems: string[] = [];

  parsed.forEach((entry, index) => {
    const result = productSchema.safeParse(entry);
    if (result.success) {
      products.push(result.data);
      return;
    }
    const code = typeof (entry as { code?: unknown })?.code === "string"
      ? ` (code "${(entry as { code: string }).code}")`
      : "";
    problems.push(
      `fila ${index + 1}${code}: ${result.error.issues.map((i) => `${i.path.join(".") || "?"} ${i.message}`).join(", ")}`,
    );
  });

  // Falla duro y ruidoso: un catalogo con una fila mala imprimiria datos equivocados
  // en una etiqueta, que es peor que un error claro en pantalla.
  if (problems.length > 0) {
    const shown = problems.slice(0, 5).join(" | ");
    const rest = problems.length > 5 ? ` (+${problems.length - 5} mas)` : "";
    throw new Error(`catalog.json tiene ${problems.length} fila(s) invalidas: ${shown}${rest}`);
  }

  // El digito de control de un EAN-13 NO es un dato que se pueda ignorar: con el digito
  // mal la etiqueta se imprime nitida y ningun lector la decodifica, que es el peor
  // fallo posible porque no se ve. Por aqui solo se avisa: la fila es valida y puede que
  // el codigo no sea EAN-13 (Code 128 admite cualquier cosa). `POST /api/labels` si
  // rechaza el caso de uso real, que es imprimir ese barcode como EAN-13.
  const unreadable = products.filter((p) => isEan13Shape(p.barcode) && ean13Problem(p.barcode));
  if (unreadable.length > 0) {
    const shown = unreadable
      .slice(0, 5)
      .map((p) => `${p.code} "${p.barcode}" (${ean13Problem(p.barcode)})`)
      .join(" | ");
    const rest = unreadable.length > 5 ? ` (+${unreadable.length - 5} mas)` : "";
    console.warn(
      `catalog.json: ${unreadable.length} barcode(s) EAN-13 con digito de control ` +
        `incorrecto, ninguna etiqueta de estos productos sera legible: ${shown}${rest}`,
    );
  }

  cache = { mtimeMs, products };
  return products;
}

function createCatalogRepository(): ProductRepository {
  return {
    async findByCode(code) {
      const wanted = normalize(code);
      if (!wanted) return null;
      return (await load()).find((p) => normalize(p.code) === wanted) ?? null;
    },

    async findByBarcode(barcode) {
      const wanted = normalize(barcode);
      if (!wanted) return null;
      return (await load()).find((p) => normalize(p.barcode) === wanted) ?? null;
    },

    async search(term) {
      const wanted = normalize(term);
      if (!wanted) return [];
      const products = await load();
      // El barcode NO entra aqui a proposito. Es un identificador unico: si no coincide
      // entero, la respuesta correcta es "no esta en el catalogo", no "aqui hay cuatro
      // productos cuyo barcode contiene esos digitos". Buscar por subcadena en el barcode
      // convierte un codigo ilegible en una sugerencia plausible y equivocada.
      // Medido sobre el catalogo de prueba: buscar "0001" devolvia 4 productos porque el
      // barcode 77506700*0001*09 de otro producto contenia esa cadena.
      return products.filter(
        (p) => normalize(p.code).includes(wanted) || normalize(p.name).includes(wanted),
      );
    },

    async list() {
      return load();
    },

    async esPrefijoDeBarcode(term) {
      const wanted = normalize(term);
      if (!wanted) return false;
      const products = await load();
      // `b.length > wanted.length` es lo que hace el prefijo ESTRICTO. Sin el, el barcode
      // "4388" seria prefijo de si mismo y el producto COCINA ELECTRICA PARA CARBON no se
      // podria escanear nunca.
      return products.some((p) => {
        const b = normalize(p.barcode);
        return b.length > wanted.length && b.startsWith(wanted);
      });
    },
  };
}

let repository: ProductRepository | null = null;

/**
 * Punto unico de acceso al catalogo. Un factory como este (y no un import directo de la
 * implementacion) es lo que permite cambiar de fuente de datos mas adelante sin tocar
 * los route handlers.
 */
export function getProductRepository(): ProductRepository {
  repository ??= createCatalogRepository();
  return repository;
}
