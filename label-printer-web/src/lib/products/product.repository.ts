import type { Product } from "./product.types";

/**
 * Contrato de acceso a productos.
 *
 * La UI y el ciclo de impresion dependen solo de esta interfaz, nunca de donde
 * vienen los datos. Hoy la implementacion lee el catalogo local (`data/catalog.json`).
 * Si XETUX vuelve, se agrega `xetux.repository.ts` con este mismo contrato y el
 * resto de la app no se toca.
 */
export interface ProductRepository {
  /** Busca por codigo interno exacto. */
  findByCode(code: string): Promise<Product | null>;
  /**
   * Todos los productos cuyo barcode es exactamente este, guardado o tal como se imprime
   * (ver `barcodeImpreso`).
   *
   * Devuelve una lista y no el primero porque el catalogo real tiene barcodes repetidos
   * (`7509546074627` son dos jabones con precios distintos). Quedarse con el primero
   * imprimia el otro producto sin avisar.
   */
  findAllByBarcode(barcode: string): Promise<Product[]>;
  /**
   * Busca coincidencias parciales en codigo y nombre.
   *
   * El barcode queda fuera a proposito: es un identificador unico y admitir coincidencias
   * parciales lo unico que hace es inventar un producto a partir de una lectura a medias.
   * Ver `resolveQuery()` en `product.lookup.ts` para saber cuando una coincidencia parcial
   * puede considerarse definitiva (nunca).
   */
  search(term: string): Promise<Product[]>;
  /** Devuelve el catalogo completo. */
  list(): Promise<Product[]>;
  /**
   * Los productos de los que `term` es prefijo ESTRICTO del barcode. O sea: si esto fuera
   * una lectura a medias, de cuales podria venir.
   *
   * Va en el contrato y no como funcion suelta porque es una pregunta **sobre los datos**:
   * la respuesta depende del catalogo, no de la forma del termino. Con 12 productos de
   * prueba la respuesta era siempre "no" y la regla de `resolveQuery()` cabia en un
   * `length`. Con los 3080 de PA PICAR hay 593 terminos que SI son prefijo de un barcode
   * real, asi que hace falta preguntar.
   *
   * No se puede resolver con un minimo de caracteres, y no es que no se haya intentado: el
   * barcode numerico mas corto del catalogo tiene 4 digitos ("4388" = COCINA ELECTRICA
   * PARA CARBON) y hay 151 productos con 4, 5 o 6. Cualquier umbral que protegiera a esos
   * tambien habria dejado de proteger a los de 7. Medido en `scripts/medir-barcode-numerico.js`.
   *
   * "Estricto" quiere decir que un barcode entero no es prefijo de si mismo: sin ese matiz el
   * producto mas corto no se podria escanear nunca.
   */
  findByBarcodePrefix(term: string): Promise<Product[]>;
}
