import { NextResponse } from "next/server";
import { z } from "zod";
import { getProductRepository } from "@/lib/products/product.catalog.repository";
import {
  conEncabezado,
  detectarColumnaCantidad,
  parseCsv,
  resolverFilas,
  type MapeoColumnas,
} from "@/lib/lotes/csv";

/**
 * `POST /api/lotes/import`: preview del mapeo de un CSV, SIN crear lote.
 *
 * `{ filename, content }` (el texto ya decodificado por el cliente) con dos extras
 * opcionales para remapear sin resubir: `mapping: { code, qty }` y `hasHeader`.
 * Sin ellos, `code` es la columna 0, `qty` se adivina por el nombre del encabezado
 * (o vale 1 si no hay columna de cantidad) y la primera fila es encabezado.
 *
 * Responde `{ columns, total, resueltas, rows }` (mas el eco de `mapping`,
 * `delimiter` y `hasHeader`, que la UI necesita para mostrar que columna adivino):
 *
 * - `columns`: nombres de columna (o "Columna N" si no hay encabezado).
 * - `total`: filas de datos (sin contar el encabezado).
 * - `resueltas`: filas que estan en el catalogo con el MISMO lookup que al
 *   imprimir. El resto trae `error` verbatim en su fila.
 * - `rows`: cada fila con `{ n, rawCode, code, qty, name, status, error? }`.
 *   `status: "ok"` aqui es "resuelta", no "impresa".
 */
export const dynamic = "force-dynamic";

/** Tope del texto subido: un CSV de etiquetas pesa KB; 2 MB ya son decenas de miles de filas. */
const MAX_CSV_BYTES = 2 * 1024 * 1024;

const bodySchema = z.object({
  filename: z.string().trim().min(1, "falta el nombre del archivo").max(160),
  content: z
    .string()
    .min(1, "el archivo viene vacio")
    .max(MAX_CSV_BYTES, "el archivo supera los 2 MB: no es un CSV de etiquetas"),
  mapping: z
    .object({
      code: z.number().int().min(0),
      qty: z.number().int().min(0).nullable(),
    })
    .optional(),
  hasHeader: z.boolean().default(true),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Solicitud invalida", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { filename, content, hasHeader } = parsed.data;

  const tabla = parseCsv(content);
  const { headers, records } = conEncabezado(tabla, hasHeader);
  if (records.length === 0) {
    return NextResponse.json(
      { error: `El archivo "${filename}" no trae filas de datos` },
      { status: 400 },
    );
  }

  const mapping: MapeoColumnas = {
    code: parsed.data.mapping?.code ?? 0,
    qty: parsed.data.mapping?.qty ?? (hasHeader ? detectarColumnaCantidad(headers) : null),
  };
  if (mapping.code >= headers.length) {
    return NextResponse.json(
      { error: `La columna de codigo (${mapping.code + 1}) no existe: el CSV trae ${headers.length}` },
      { status: 400 },
    );
  }
  if (mapping.qty !== null && mapping.qty >= headers.length) {
    return NextResponse.json(
      { error: `La columna de cantidad (${mapping.qty + 1}) no existe: el CSV trae ${headers.length}` },
      { status: 400 },
    );
  }

  let rows;
  try {
    rows = await resolverFilas(getProductRepository(), records, mapping);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  return NextResponse.json({
    columns: headers,
    total: rows.length,
    resueltas: rows.filter((r) => r.status === "ok").length,
    rows,
    mapping,
    delimiter: tabla.delimiter,
    hasHeader,
  });
}
