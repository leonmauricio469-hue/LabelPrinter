import { NextResponse } from "next/server";
import { z } from "zod";
import { getTemplate, updateTemplate } from "@/lib/labels/templates.store";

/**
 * `GET /api/templates/[id]`: una plantilla, o 404 si no existe.
 *
 * `params` es una promesa en Next 16: se espera (`await`) antes de usarla.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) {
    return NextResponse.json({ error: `La plantilla "${id}" no existe` }, { status: 404 });
  }
  return NextResponse.json(template);
}

const cambiosSchema = z
  .object({
    name: z.string().trim().min(1, "el nombre no puede quedar vacio").max(120).optional(),
    category: z.string().trim().min(1, "la categoria no puede quedar vacia").max(80).optional(),
    archived: z.boolean().optional(),
  })
  .refine((c) => c.name !== undefined || c.category !== undefined || c.archived !== undefined, {
    message: "no hay nada que cambiar: manda name, category o archived",
  });

/**
 * `PUT /api/templates/[id]`: renombra, recategoriza, archiva o desarchiva.
 *
 * Solo esos tres campos: las zonas no se editan aqui (eso es el editor, F6). Un cuerpo
 * sin ningun campo valido es 400, no un 200 que no hizo nada.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = cambiosSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Solicitud invalida", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const actualizada = await updateTemplate(id, parsed.data);
    if (!actualizada) {
      return NextResponse.json({ error: `La plantilla "${id}" no existe` }, { status: 404 });
    }
    return NextResponse.json(actualizada);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
