import { NextResponse } from "next/server";
import { z } from "zod";
import { getProductRepository } from "@/lib/products/product.catalog.repository";
import { getTemplate } from "@/lib/labels/templates.store";
import { TEMPLATES } from "@/lib/labels/label.template";
import {
  createLote,
  listLotes,
  recount,
  type Lote,
  type LoteRow,
} from "@/lib/lotes/lotes.store";

/**
 * `GET /api/lotes`: la cola, los mas nuevos primero, SIN las filas (la tabla de
 * filas la trae el detalle). Cada resumen lleva `total` para el progreso.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const lotes = await listLotes();
    return NextResponse.json({
      lotes: lotes.map(({ rows, ...resto }: Lote) => ({ ...resto, total: rows.length })),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

const crearSchema = z.object({
  name: z.string().trim().min(1, "el lote necesita un nombre").max(120),
  filename: z.string().trim().min(1, "falta el nombre del archivo").max(160),
  templateId: z.string().min(1).max(64).optional(),
  mapping: z.object({
    code: z.number().int().min(0),
    qty: z.number().int().min(0).nullable(),
  }),
  /** Lo crudo del CSV; los nombres NO se aceptan del cliente (salen del catalogo). */
  rows: z
    .array(z.object({ rawCode: z.string().max(120), qty: z.coerce.number().int() }))
    .min(1, "el lote no trae filas"),
});

/**
 * `POST /api/lotes`: crea un lote `en-espera` desde filas ya mapeadas.
 *
 * NO confia en el cliente: cada fila se re-resuelve contra el catalogo con el
 * mismo lookup que al imprimir. La resuelta queda `pendiente`, la que no queda
 * `error` con el motivo verbatim. Nada se imprime al crear.
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

  // Con `templateId` explicito no hay caida silenciosa: si no existe, es 404, igual
  // que en `POST /api/labels`. Sin el, la activa de settings al imprimir.
  if (parsed.data.templateId) {
    const existe =
      (await getTemplate(parsed.data.templateId)) ??
      TEMPLATES.find((t) => t.id === parsed.data.templateId);
    if (!existe) {
      return NextResponse.json(
        { error: `La plantilla "${parsed.data.templateId}" no existe` },
        { status: 404 },
      );
    }
  }

  let repo;
  try {
    repo = getProductRepository();
    await repo.list();
  } catch (err) {
    // Catalogo corrupto: es un 500 con el motivo, no un lote a medias.
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const filas: LoteRow[] = [];
  for (let i = 0; i < parsed.data.rows.length; i++) {
    const n = i + 1;
    const rawCode = parsed.data.rows[i].rawCode.trim();
    const qty = parsed.data.rows[i].qty;
    if (rawCode === "") {
      filas.push({ n, rawCode, code: rawCode, qty: 1, status: "error", error: `Fila ${n}: no trae codigo` });
      continue;
    }
    if (qty < 1) {
      filas.push({ n, rawCode, code: rawCode, qty, status: "error", error: `Fila ${n}: la cantidad minima es 1` });
      continue;
    }
    let producto = null;
    try {
      producto = (await repo.findByCode(rawCode)) ?? (await repo.findByBarcode(rawCode));
    } catch (err) {
      filas.push({ n, rawCode, code: rawCode, qty, status: "error", error: `Fila ${n}: ${(err as Error).message}` });
      continue;
    }
    if (!producto) {
      filas.push({ n, rawCode, code: rawCode, qty, status: "error", error: `Codigo "${rawCode}" no esta en el catalogo` });
      continue;
    }
    filas.push({ n, rawCode, code: producto.code, qty, status: "pendiente" });
  }

  try {
    const lote = await createLote({
      name: parsed.data.name,
      filename: parsed.data.filename,
      ...(parsed.data.templateId ? { templateId: parsed.data.templateId } : {}),
      mapping: parsed.data.mapping,
      rows: filas,
    });
    recount(lote);
    return NextResponse.json(lote);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
