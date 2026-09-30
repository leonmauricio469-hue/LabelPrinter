// Ruta relativa a proposito, como en `product.lookup.ts`: los scripts no resuelven `@/`.
import { barcodeImpreso } from "../labels/barcode-plan";
import type { Product } from "./product.types";
import type { ProductRepository } from "./product.repository";

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
export function normalize(value: string): string {
  return value.replace(/[\s-]/g, "").toLowerCase();
}

/**
 * El barcode tal como esta guardado y tal como sale en la etiqueta, normalizados.
 *
 * "0", "000..." y "null" son lo que el sistema de origen guarda cuando NO hay barcode (ver
 * `planBarcode`): no identifican a nadie, y hay varios productos con cada uno.
 */
function barcodeForms(p: Product): string[] {
  if (/^(0*|null)$/i.test(normalize(p.barcode))) return [];
  return [normalize(p.barcode), normalize(barcodeImpreso(p.barcode))];
}

/**
 * `ProductRepository` sobre una lista ya cargada. Sin E/S: el repositorio del catalogo le
 * pasa lo que leyo de disco, y las pruebas le pasan productos de ejemplo. Asi las dos cosas
 * ejercitan las mismas reglas de coincidencia.
 */
export function createInMemoryRepository(
  getProducts: () => Promise<Product[]>,
): ProductRepository {
  return {
    async findByCode(code) {
      const wanted = normalize(code);
      if (!wanted) return null;
      return (await getProducts()).find((p) => normalize(p.code) === wanted) ?? null;
    },

    async findAllByBarcode(barcode) {
      const wanted = normalize(barcode);
      if (!wanted) return [];
      return (await getProducts()).filter((p) => barcodeForms(p).includes(wanted));
    },

    async search(term) {
      const wanted = normalize(term);
      if (!wanted) return [];
      // El barcode NO entra aqui a proposito. Es un identificador unico: si no coincide
      // entero, la respuesta correcta es "no esta en el catalogo", no "aqui hay cuatro
      // productos cuyo barcode contiene esos digitos". Buscar por subcadena en el barcode
      // convierte un codigo ilegible en una sugerencia plausible y equivocada.
      // Medido sobre el catalogo de prueba: buscar "0001" devolvia 4 productos porque el
      // barcode 77506700*0001*09 de otro producto contenia esa cadena.
      return (await getProducts()).filter(
        (p) => normalize(p.code).includes(wanted) || normalize(p.name).includes(wanted),
      );
    },

    async list() {
      return getProducts();
    },

    async findByBarcodePrefix(term) {
      const wanted = normalize(term);
      if (!wanted) return [];
      // `b.length > wanted.length` es lo que hace el prefijo ESTRICTO. Sin el, el barcode
      // "4388" seria prefijo de si mismo y el producto COCINA ELECTRICA PARA CARBON no se
      // podria escanear nunca.
      return (await getProducts()).filter((p) =>
        barcodeForms(p).some((b) => b.length > wanted.length && b.startsWith(wanted)),
      );
    },
  };
}
