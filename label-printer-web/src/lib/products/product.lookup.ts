// Ruta RELATIVA y no `@/lib/labels/barcode-plan` a proposito. Los scripts de
// `tsconfig.preview.json` compilan a CommonJS y no resuelven alias en runtime: un `@/`
// pasaria la comprobacion de tipos y reventaria con `Cannot find module` al ejecutar el
// script, que es justo cuando ya no se puede arreglar. Aqui el fallo sale en `tsc`.
import { variantesDeBusqueda } from "../labels/barcode-plan";
import type { Product } from "./product.types";
import type { ProductRepository } from "./product.repository";

/**
 * Como se encontro un producto a partir de lo que escanee/teclee el operador.
 *
 * Existe porque "encontrado" no es lo mismo que "encontrado exactamente", y confundir
 * las dos cosas imprime etiquetas del producto equivocado:
 *
 * - `exact`     -> el codigo o el barcode coinciden **enteros**. Se puede imprimir sin
 *                  preguntar: el operador escaneo justo ese producto.
 * - `ambiguous` -> el termino es un identificador COMPLETO, pero no de uno solo: el barcode
 *                  esta repetido, o tambien es el principio de otro barcode (lectura a
 *                  medias posible). Los completos van primero; **alguien tiene que elegir**.
 * - `partial`   -> coincidencia por subcadena en codigo o nombre. Sirve para la busqueda
 *                  manual, pero **alguien tiene que elegir**. Nadie debe imprimir a ciegas.
 * - `none`      -> no hay nada. La respuesta correcta es avisar, no adivinar.
 * - `all`       -> se pidio el catalogo entero, sin termino. No es una coincidencia: es un
 *                  listado, y no habilita nada por si mismo.
 * - `too-short` -> el termino es demasiado corto para buscar por subcadena. No es lo mismo
 *                  que "none": aqui hay productos, pero el operador todavia no ha escrito
 *                  lo suficiente, y decirle "no esta en el catalogo" seria mentira.
 *
 * Caso real que obligo a separarlas: un barcode leido a medias (11 de 13 digitos por un
 * codigo danado) coincidia por subcadena con el barcode completo y devolvia **un solo**
 * producto, indistinguible de una lectura buena. En `/fast` eso imprimia sin preguntar.
 */
export type MatchKind = "exact" | "ambiguous" | "partial" | "none" | "all" | "too-short";

export interface LookupOutcome {
  match: MatchKind;
  products: Product[];
  /**
   * Cuantos coincidian antes de cortar a `MAX_BUSQUEDA`. Sin esto la UI decia "60 productos
   * coinciden" aunque fueran cientos, y no pedia escribir mas.
   */
  total?: number;
}

/**
 * Caracteres minimos para una busqueda por subcadena.
 *
 * Medido sobre el catalogo real de PA PICAR (3080 productos), no supuesto:
 *
 *   "A"     -> 2828 productos
 *   "PA"    ->  392 productos
 *   "LECHE" ->   55 productos
 *
 * Con 12 productos de prueba, "01" daba 4 y este umbral no hacia falta. Con 3080, dos
 * letras devuelven casi la mitad del catalogo: la peticion pesa cientos de kilobytes y la
 * lista en pantalla no ayuda a nadie a elegir. Tres caracteres es el punto en el que la
 * busqueda empieza a ser util.
 *
 * Esto limita la busqueda PARCIAL. Que el termino sea corto no lo convierte en no
 * confiable: "4388" son cuatro caracteres y es el barcode ENTERO de COCINA ELECTRICA PARA
 * CARBON. Si un termino corto es un barcode completo se acepta como exacto.
 */
export const MIN_BUSQUEDA = 3;

/**
 * Cuantos productos devuelve como mucho una busqueda parcial.
 *
 * 3080 productos de catalogo no caben comodos en una lista que alguien tenga que recorrer
 * con el escaner en la otra mano. Es un tope de seguridad, no un ranking: si se llega a el,
 * la respuesta correcta es escribir mas, no poner 60 resultados en pantalla y fingir que
 * son todos.
 */
export const MAX_BUSQUEDA = 60;

/**
 * Resuelve un termino contra el catalogo y dice **como** lo encontro.
 *
 * Orden deliberado, y el orden ES la logica:
 *
 *   1. completos: por barcode (guardado o impreso), y si no hay, por codigo
 *   2. uno solo y que no sea el principio de otro barcode -> `exact`
 *   3. varios, o principio de otro barcode -> `ambiguous`, los completos primero
 *   4. repetir 1-3 con la otra forma del mismo barcode (el 0 delante del UPC-A)
 *   5. subcadena, solo si el termino tiene `MIN_BUSQUEDA` caracteres
 *
 * Por que el paso 3 existe y no un filtro de longitud: este es el fallo mas grave que abre
 * el catalogo real, y no se arregla con un numero.
 *
 *   Con los 12 productos de prueba, el `code` era "P-0001". Un escaner, que solo produce
 *   numeros, jamas podia acertar con un codigo, y el problema no existia.
 *
 *   Con el export de PA PICAR la columna `#` son 3080 filas y el `code` quedo como "1",
 *   "2", ..., "3080", a pelo. A partir de ahi, un escaner que entrega una lectura a medias
 *   puede dar en un producto EXACTO. El caso real: el barcode "4388" es COCINA ELECTRICA
 *   PARA CARBON, y "4", "43" y "438" son los codes de los productos 4, 43 y 438. Si el
 *   escaner se come el ultimo digito, entrega "438", la busqueda da **exacta**, y `/fast`
 *   imprime la etiqueta de otro producto sin preguntar. Hay 593 terminos asi.
 *
 * Un minimo de caracteres lo taparia mal. El barcode numerico mas corto del catalogo tiene
 * 4 digitos ("4388") y hay 151 productos con 4, 5 o 6; cualquier umbral que protegiera a
 * esos dejaria de proteger a los de 7 y solo moveria el fallo. La pregunta que si funciona
 * es "¿este texto puede ser un codigo de barras al que le falta el final?", y esa depende
 * de los datos, no de la forma del termino: por eso vive en el repositorio
 * (`findByBarcodePrefix`).
 *
 * Antes, un termino que era principio de otro barcode se DESCARTABA. Eso protegia el
 * escaneo, pero dejaba sin busqueda exacta a 285 codigos completos ("1", "438"...) y a
 * barcodes enteros como "4796019560234". Ofrecerlo para elegir protege igual y no pierde
 * a nadie.
 *
 * El barcode va ANTES que el codigo. El barcode es lo que produce el escaner; el `code` es
 * un identificador interno de la app. Si un termino fuera las dos cosas, el operador casi
 * seguro esta escaneando. Ademas los dos caminos (esta busqueda y `POST /api/labels`)
 * tienen que resolver IGUAL, o la pantalla muestra un producto y se imprime otro.
 *
 * La coincidencia parcial nunca se considera una respuesta definitiva, ni aunque devuelva
 * un solo producto.
 */
export async function resolveQuery(
  repo: ProductRepository,
  query: string,
): Promise<LookupOutcome> {
  const q = query.trim();
  if (q === "") return { match: "none", products: [] };

  const variantes = variantesDeBusqueda(q);

  for (const candidato of variantes) {
    const porBarcode = await repo.findAllByBarcode(candidato);
    const porCode = porBarcode.length > 0 ? null : await repo.findByCode(candidato);
    const completos = porCode ? [porCode] : porBarcode;
    if (completos.length === 0) continue;

    // Lectura a medias: este texto puede ser un barcode al que le falta el final. Sin esto,
    // escanear COCINA ELECTRICA PARA CARBON ("4388") comiendose el ultimo digito imprimiria
    // el producto 438. Que es justo el fallo.
    const podriaSerCortado = await repo.findByBarcodePrefix(candidato);

    if (completos.length === 1 && podriaSerCortado.length === 0) {
      return { match: "exact", products: completos };
    }
    // Un identificador completo que ademas es ambiguo (barcode repetido, o prefijo de otro
    // barcode) no se descarta ni se imprime a ciegas: se ofrece primero y alguien elige.
    const vistos = new Set(completos);
    const ofrecidos = [...completos, ...podriaSerCortado.filter((p) => !vistos.has(p))];
    return { match: "ambiguous", products: ofrecidos.slice(0, MAX_BUSQUEDA), total: ofrecidos.length };
  }

  const limpio = variantes[0];
  if (limpio.length < MIN_BUSQUEDA) return { match: "too-short", products: [] };

  const partial = await repo.search(limpio);
  if (partial.length === 0) return { match: "none", products: [] };

  return { match: "partial", products: partial.slice(0, MAX_BUSQUEDA), total: partial.length };
}
