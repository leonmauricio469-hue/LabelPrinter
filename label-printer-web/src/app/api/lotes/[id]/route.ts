import { NextResponse } from "next/server";
import { getLote } from "@/lib/lotes/lotes.store";

/**
 * `GET /api/lotes/[id]`: el lote con sus filas y su progreso.
 *
 * `params` es una promesa en Next 16: se espera (`await`) antes de usarla.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let lote;
  try {
    lote = await getLote(id);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
  if (!lote) {
    return NextResponse.json({ error: `El lote "${id}" no existe` }, { status: 404 });
  }
  return NextResponse.json({
    ...lote,
    progreso: {
      total: lote.rows.length,
      hechas: lote.done,
      errores: lote.errors,
      pendientes: lote.rows.length - lote.done - lote.errors,
    },
  });
}
