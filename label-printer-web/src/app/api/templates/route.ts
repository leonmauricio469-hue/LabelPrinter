import { NextResponse } from "next/server";
import { z } from "zod";
import {
  listTemplates,
  createTemplate,
} from "@/lib/labels/templates.store";

/**
 * `GET /api/templates`: la biblioteca, filtrable.
 *
 * - `q`: texto en nombre, id o categoria.
 * - `categoria`: igualdad exacta con una categoria real de lo guardado.
 * - `dpi`: igualdad exacta (203 en la GX420 real).
 * - `incluirArchivadas=1`: tambien las archivadas; sin el, solo activas.
 */
export const dynamic = "force-dynamic";

const filtrosSchema = z.object({
  q: z.string().max(120).optional(),
  categoria: z.string().max(80).optional(),
  dpi: z.coerce.number().int().min(72).max(1200).optional(),
  incluirArchivadas: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),
});

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const parsed = filtrosSchema.safeParse({
    q: params.get("q") ?? undefined,
    categoria: params.get("categoria") ?? undefined,
    dpi: params.get("dpi") ?? undefined,
    incluirArchivadas: params.get("incluirArchivadas") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Filtros invalidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const templates = await listTemplates(parsed.data);
  return NextResponse.json({ templates });
}

const crearSchema = z.object({
  name: z.string().trim().min(1, "la plantilla necesita un nombre").max(120),
  category: z.string().trim().min(1).max(80).optional(),
  from: z.string().min(1).max(64).default("blanco"),
});

/**
 * `POST /api/templates`: crea una plantilla.
 *
 * `{ name, category?, from? }`, donde `from` es un id existente o `'blanco'` (59x35 con
 * solo el marco, estructurada). Responde 200 con la plantilla creada, incluido su id.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = crearSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Solicitud invalida", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const creada = await createTemplate(parsed.data);
    return NextResponse.json(creada);
  } catch (err) {
    // El unico fallo esperado: `from` con un id que no existe. Es dato del cliente.
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }
}
