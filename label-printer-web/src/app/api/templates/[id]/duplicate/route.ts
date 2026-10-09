import { NextResponse } from "next/server";
import { duplicateTemplate } from "@/lib/labels/templates.store";

/**
 * `POST /api/templates/[id]/duplicate`: copia con id nuevo.
 *
 * Responde 200 con la copia, o 404 si el original no existe. La copia nunca sale
 * archivada: duplicar para esconder no tiene sentido.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const copia = await duplicateTemplate(id);
  if (!copia) {
    return NextResponse.json({ error: `La plantilla "${id}" no existe` }, { status: 404 });
  }
  return NextResponse.json(copia);
}
