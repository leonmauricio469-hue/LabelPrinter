import { NextResponse } from "next/server";
import { getProductRepository } from "@/lib/products/product.catalog.repository";
import { resolveQuery } from "@/lib/products/product.lookup";

/**
 * `GET /api/products`
 *
 * - sin `q`      -> catalogo completo
 * - con `q`      -> ver `resolveQuery()`
 *
 * La respuesta lleva `match` ademas de `products`, y eso no es decorativo:
 *
 * - `exact`   -> el codigo o el barcode coincidieron enteros. Se puede imprimir sin
 *                preguntar.
 * - `partial` -> coincidencia por subcadena. Alguien tiene que elegir; imprimir con esto
 *                es imprimir una suposicion.
 * - `none`    -> no hay nada.
 *
 * Sin este campo, un cliente no podia distinguir "es este producto" de "hay 9 productos
 * que contienen estas letras", y `/fast` imprimia `products[0]` sin preguntar. Ver
 * [[Prueba Coincidencias]].
 *
 * Se responde 200 con `{ products: [] }` cuando no hay coincidencias, y no 404: para el
 * operador "no existe" y "la app esta caida" tienen que verse distinto, y la UI lo
 * muestra como lista vacia con un mensaje.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const products = getProductRepository();

  try {
    if (q === "") {
      const all = await products.list();
      return NextResponse.json({ products: all, match: "all" });
    }

    const outcome = await resolveQuery(products, q);
    return NextResponse.json(outcome);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
