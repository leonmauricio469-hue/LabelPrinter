import { NextResponse } from "next/server";
import { z } from "zod";
import { ejecutarImpresion } from "@/app/api/labels/route";
import {
  getLote,
  listLotes,
  recount,
  saveLote,
} from "@/lib/lotes/lotes.store";

/**
 * `POST /api/lotes/[id]/control`: `{ action }` con
 * `start | pause | resume | cancel | retry-failed`.
 *
 * COMO SE EJECUTA (leer antes de tocar):
 *
 * - La llamada que inicia (o retoma) ES la ejecucion: recorre las filas
 *   `pendiente` en orden, una por una, por `ejecutarImpresion()` —el MISMO ciclo
 *   que `POST /api/labels` (validar, catalogo, plantilla, transporte, auditoria).
 *   Cada etiqueta del lote queda asi en el historial por la via normal, con su
 *   propio `jobId`: no hay via paralela de auditoria.
 * - Pausa, cancelacion y retorno solo ENTRE etiquetas: el bucle relee el lote
 *   antes de cada fila y se detiene si el estado ya no es `en-curso`. Una etiqueta
 *   a medio imprimir siempre termina (para bien o para mal); lo que se frena es
 *   la SIGUIENTE.
 * - Cada fila se persiste al terminarla (`ok` o `error` verbatim). Si el servidor
 *   se cae a mitad, el lote queda `en-curso` en disco sin nadie ejecutandolo: la
 *   proxima llamada de control lo reconcilia a `pausado` (huerfano), retomable con
 *   `resume`. Lo ya impreso no se repite.
 * - UN lote activo por vez: `start` (o retomar) con otro lote en curso es 409
 *   honesto. No hay "Priorizar" ni cola multi-lote: eso seria otro producto.
 *
 * `params` es una promesa en Next 16: se espera (`await`) antes de usarla.
 */
export const dynamic = "force-dynamic";

/** Lotes con un bucle de ejecucion vivo EN ESTE proceso. */
const ejecutando = new Set<string>();

const bodySchema = z.object({
  action: z.enum(["start", "pause", "resume", "cancel", "retry-failed"], {
    message: "action debe ser start, pause, resume, cancel o retry-failed",
  }),
});

/**
 * `en-curso` en disco sin bucle vivo en este proceso: la llamada que imprimia
 * murio (reinicio del servidor). Vuelven a `pausado`, que es retomable y no miente.
 */
async function reconciliarHuerfanos(): Promise<number> {
  const lotes = await listLotes();
  let n = 0;
  for (const lote of lotes) {
    if (lote.status === "en-curso" && !ejecutando.has(lote.id)) {
      lote.status = "pausado";
      lote.updatedAt = new Date().toISOString();
      await saveLote(lote);
      n++;
    }
  }
  return n;
}

function hayOtroEnCurso(exceptoId: string): boolean {
  if ([...ejecutando].some((id) => id !== exceptoId)) return true;
  return false;
}

/**
 * Recorre las pendientes hasta agotarlas o hasta que el estado deje de ser
 * `en-curso` (pausa o cancelacion pedidas por otra llamada entre filas).
 */
async function ejecutarLote(id: string): Promise<void> {
  ejecutando.add(id);
  try {
    for (;;) {
      const lote = await getLote(id);
      if (!lote || lote.status !== "en-curso") return;
      const fila = lote.rows.find((r) => r.status === "pendiente");
      if (!fila) {
        lote.status = "finalizado";
        lote.updatedAt = new Date().toISOString();
        recount(lote);
        await saveLote(lote);
        return;
      }
      const resultado = await ejecutarImpresion({
        productCode: fila.code,
        qty: fila.qty,
        mode: "normal",
        ...(lote.templateId ? { templateId: lote.templateId } : {}),
      });
      if (resultado.ok) {
        fila.status = "ok";
        delete fila.error;
      } else {
        // El motivo verbatim: es lo que el operador necesita para decidir (papel,
        // medio, catalogo) y lo que el historial ya registro por la via normal.
        fila.status = "error";
        fila.error = resultado.error;
      }
      recount(lote);
      lote.updatedAt = new Date().toISOString();
      await saveLote(lote);
    }
  } finally {
    ejecutando.delete(id);
  }
}

export async function POST(
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
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Solicitud invalida", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let reconciliados = 0;
  try {
    reconciliados = await reconciliarHuerfanos();
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const lote = await getLote(id);
  if (!lote) {
    return NextResponse.json({ error: `El lote "${id}" no existe` }, { status: 404 });
  }

  const action = parsed.data.action;
  const ahora = () => new Date().toISOString();

  if (action === "pause") {
    if (lote.status !== "en-curso") {
      return NextResponse.json(
        { error: `El lote esta ${lote.status}: solo se pausa uno en curso`, reconciliados },
        { status: 400 },
      );
    }
    lote.status = "pausado";
    lote.updatedAt = ahora();
    return NextResponse.json({ lote: await saveLote(lote), reconciliados });
  }

  if (action === "cancel") {
    if (lote.status !== "en-espera" && lote.status !== "en-curso" && lote.status !== "pausado") {
      return NextResponse.json(
        { error: `El lote esta ${lote.status}: ya no se puede cancelar`, reconciliados },
        { status: 400 },
      );
    }
    lote.status = "cancelado";
    lote.updatedAt = ahora();
    return NextResponse.json({ lote: await saveLote(lote), reconciliados });
  }

  // De aqui en adelante la llamada PUEDE imprimir: hay que ser el unico activo.
  if (action === "start" || action === "resume" || action === "retry-failed") {
    if (action === "start" && lote.status !== "en-espera") {
      return NextResponse.json(
        {
          error:
            lote.status === "pausado"
              ? "El lote esta pausado: usa resume para seguir donde quedo"
              : `El lote esta ${lote.status}: ya no se puede iniciar`,
          reconciliados,
        },
        { status: 400 },
      );
    }
    if (action === "resume" && lote.status !== "pausado") {
      return NextResponse.json(
        { error: `El lote esta ${lote.status}: solo se retoma uno pausado`, reconciliados },
        { status: 400 },
      );
    }
    if (
      action === "retry-failed" &&
      lote.status !== "finalizado" &&
      lote.status !== "pausado" &&
      lote.status !== "cancelado"
    ) {
      return NextResponse.json(
        { error: `El lote esta ${lote.status}: no hay reintento pendiente`, reconciliados },
        { status: 400 },
      );
    }

    if (action === "retry-failed") {
      recount(lote);
      if (lote.errors === 0) {
        return NextResponse.json(
          { error: "El lote no tiene filas con error: no hay nada que reintentar", reconciliados },
          { status: 400 },
        );
      }
      // Solo las de error vuelven a pendiente; lo ya impreso no se repite. El
      // catalogo se re-resuelve al imprimir (pudo cargarse el barcode real desde
      // entonces), asi que una fila que fallo por "no esta en el catalogo" puede
      // salir bien ahora sin tocar el CSV.
      for (const fila of lote.rows) {
        if (fila.status === "error") {
          fila.status = "pendiente";
          delete fila.error;
        }
      }
    }

    const otros = await listLotes();
    if (otros.some((l) => l.id !== id && l.status === "en-curso") || hayOtroEnCurso(id)) {
      return NextResponse.json(
        { error: "Hay otro lote en curso: termina o pausalo antes de iniciar este", reconciliados },
        { status: 409 },
      );
    }

    lote.status = "en-curso";
    lote.updatedAt = ahora();
    recount(lote);
    await saveLote(lote);
    // La llamada ES la ejecucion: vuelve cuando la cola se agota o se frena entre
    // filas. El lote ya respondido trae su estado final.
    await ejecutarLote(id);
    return NextResponse.json({ lote: (await getLote(id)) ?? lote, reconciliados });
  }

  return NextResponse.json({ error: "Accion desconocida", reconciliados }, { status: 400 });
}
