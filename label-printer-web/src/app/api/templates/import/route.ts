import { NextResponse } from "next/server";
import { z } from "zod";
import {
  importJsonTemplate,
  importRawZpl,
  MAX_ZPL_BYTES,
} from "@/lib/labels/templates.store";

/**
 * `POST /api/templates/import`: trae una plantilla de fuera.
 *
 * - `{ format: 'json', content }`: nuestro propio formato (lo que exporta la
 *   biblioteca), como texto o como objeto. Siempre con id NUEVO: reimportar una
 *   exportacion es una copia, no un reemplazo.
 * - `{ format: 'zpl', name?, content }`: ZPL tal cual, plantilla raw verbatim con la
 *   caption honesta (sin vista previa, se envia tal cual).
 *
 * Se rechaza el vacio y lo gigante (>256 KB): por encima no es una etiqueta.
 */
export const dynamic = "force-dynamic";

const importSchema = z.object({
  format: z.enum(["json", "zpl"], { message: "format tiene que ser 'json' o 'zpl'" }),
  name: z.string().trim().min(1).max(120).optional(),
  content: z.unknown(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Solicitud invalida", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { format, name, content } = parsed.data;

  try {
    if (format === "json") {
      const texto = typeof content === "string" ? content : JSON.stringify(content);
      if (texto.trim() === "") {
        return NextResponse.json({ error: "El contenido viene vacio: no hay nada que importar." }, { status: 400 });
      }
      if (texto.length > MAX_ZPL_BYTES) {
        return NextResponse.json(
          { error: `El contenido pesa mas de ${MAX_ZPL_BYTES / 1024} KB: no es una plantilla.` },
          { status: 400 },
        );
      }
      let objeto: unknown = content;
      if (typeof content === "string") {
        try {
          objeto = JSON.parse(content);
        } catch {
          return NextResponse.json({ error: "El contenido no es JSON valido." }, { status: 400 });
        }
      }
      const creada = await importJsonTemplate(objeto);
      return NextResponse.json(creada);
    }

    if (typeof content !== "string") {
      return NextResponse.json({ error: "El ZPL tiene que venir como texto." }, { status: 400 });
    }
    const creada = await importRawZpl({ name, content });
    return NextResponse.json(creada);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
