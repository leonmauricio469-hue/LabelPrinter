import { NextResponse } from "next/server";
import { z } from "zod";
import { aplicarOscuridad } from "@/app/api/labels/route";
import { readSettings } from "@/lib/settings/settings.store";
import { templateForPrint } from "@/lib/labels/label-override.store";
import { getTemplate } from "@/lib/labels/templates.store";
import { TEMPLATES, dotsFromMm } from "@/lib/labels/label.template";
import {
  barcodeZoneOf,
  buildZplBatch,
  planForZone,
  problemaDeMedio,
  quietZoneDots,
} from "@/lib/labels/zpl.builder";
import { QUIET_FACTOR } from "@/lib/labels/barcode-plan";
import { createPrinterTransport } from "@/lib/printing/printer.transport";
import { getProductRepository } from "@/lib/products/product.catalog.repository";
import { appendPrintRecord, type PrintRecord } from "@/lib/audit/audit.store";
import type { LabelData } from "@/lib/labels/label.types";
import {
  getLote,
  listLotes,
  recount,
  saveLote,
  type Lote,
} from "@/lib/lotes/lotes.store";

/**
 * `POST /api/lotes/[id]/control`: `{ action }` con
 * `start | pause | resume | cancel | retry-failed`.
 *
 * COMO SE EJECUTA (leer antes de tocar):
 *
 * - La llamada que inicia (o retoma) ES la ejecucion: resuelve todas las filas
 *   `pendiente` en orden (producto, plantilla, medio) y acumula sus bloques
 *   `^XA...^XZ` en UN solo `transport.send` (cada fila aporta sus copias, igual
 *   que `buildZplBatch()` junta N copias en un trabajo). Un lote de 20 filas
 *   cuesta 1 spawn, no ~20.
 * - La auditoria sigue siendo POR FILA: cada fila enviada se registra en el
 *   historial con su propio `jobId` (ok o error verbatim del transporte), igual
 *   que si hubiera ido sola. Lo que falla ANTES de enviar (producto, plantilla,
 *   medio) marca la fila con error sin auditar, igual que `POST /api/labels`.
 * - Pausa y cancelacion actuan en el borde del lote, no entre filas: el envio es
 *   atomico (si falla, no sale la mitad). Si el estado dejo de ser `en-curso`
 *   antes de enviar, no se envia nada y lo pendiente queda pendiente.
 * - Cada ejecucion persiste una sola vez (`recount` + `saveLote`), no una por
 *   fila. Si el servidor se cae a mitad, el lote queda `en-curso` en disco sin
 *   nadie ejecutandolo: la proxima llamada de control lo reconcilia a `pausado`
 *   (huerfano), retomable con `resume`. Lo ya impreso no se repite.
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
 * Registra la impresion sin propagar el fallo: el papel ya salio, el historial
 * es un extra. Igual que `safeAudit()` de `POST /api/labels`.
 */
async function auditarSinRomper(
  entry: Parameters<typeof appendPrintRecord>[0],
): Promise<PrintRecord | null> {
  try {
    return await appendPrintRecord(entry);
  } catch (err) {
    console.error("No se pudo escribir en print-history.jsonl:", (err as Error).message);
    return null;
  }
}

/** Copia los resultados (`ok`/`error`) de un lote resuelto al lote fresco. */
function volcarResultados(origen: Lote, destino: Lote): void {
  for (const r of origen.rows) {
    if (r.status === "pendiente") continue;
    const d = destino.rows.find((x) => x.n === r.n);
    if (!d) continue;
    d.status = r.status;
    if (r.error) d.error = r.error;
    else delete d.error;
  }
}

/**
 * Resuelve las pendientes y las envia en UN solo trabajo.
 *
 * Cada fila valida igual que `POST /api/labels` (catalogo, plantilla, medio,
 * zona quieta) y aporta sus bloques `^XA...^XZ`; el transporte ve un solo
 * envio con todos los bloques concatenados. La auditoria y el `saveLote` son
 * los mismos de antes, por fila y una sola vez respectivamente. Sin `^PQ`
 * (sin verificar en este proyecto): la cantidad sale de bloques repetidos.
 */
async function ejecutarLote(id: string): Promise<void> {
  ejecutando.add(id);
  try {
    const lote = await getLote(id);
    if (!lote || lote.status !== "en-curso") return;
    if (!lote.rows.some((r) => r.status === "pendiente")) {
      lote.status = "finalizado";
      lote.updatedAt = new Date().toISOString();
      recount(lote);
      await saveLote(lote);
      return;
    }

    const settings = await readSettings();
    const wantedId = lote.templateId ?? settings.label.templateId;

    // Plantilla explicita inexistente: todas las pendientes fallan igual que en
    // `POST /api/labels` (404, sin auditar, sin gastar papel).
    if (lote.templateId) {
      const existe =
        (await getTemplate(lote.templateId)) ??
        TEMPLATES.find((t) => t.id === lote.templateId);
      if (!existe) {
        for (const fila of lote.rows) {
          if (fila.status !== "pendiente") continue;
          fila.status = "error";
          fila.error = `La plantilla "${lote.templateId}" no existe`;
        }
        recount(lote);
        lote.updatedAt = new Date().toISOString();
        if (!lote.rows.some((r) => r.status === "pendiente")) lote.status = "finalizado";
        await saveLote(lote);
        return;
      }
    }

    const rawT = await getTemplate(wantedId);
    const rawZpl = rawT && rawT.kind === "raw" && rawT.zpl ? rawT.zpl : null;
    const rawAnchoMm = rawT && rawT.kind === "raw" ? rawT.widthMm : 0;
    const rawNombre = rawT && rawT.kind === "raw" ? rawT.name : "";
    const mediaWidthDots = dotsFromMm(settings.printer.mediaWidthMm);

    if (rawZpl) {
      if (mediaWidthDots < dotsFromMm(rawAnchoMm)) {
        for (const fila of lote.rows) {
          if (fila.status !== "pendiente") continue;
          fila.status = "error";
          fila.error =
            `No se imprime: el medio cargado mide ${settings.printer.mediaWidthMm} mm y la ` +
            `plantilla "${rawNombre}" mide ${rawAnchoMm} mm.`;
        }
        recount(lote);
        lote.updatedAt = new Date().toISOString();
        if (!lote.rows.some((r) => r.status === "pendiente")) lote.status = "finalizado";
        await saveLote(lote);
        return;
      }
    } else {
      const template = await templateForPrint(wantedId);
      const problema = problemaDeMedio(template, mediaWidthDots);
      if (problema) {
        for (const fila of lote.rows) {
          if (fila.status !== "pendiente") continue;
          fila.status = "error";
          fila.error = `No se imprime: ${problema}`;
        }
        recount(lote);
        lote.updatedAt = new Date().toISOString();
        if (!lote.rows.some((r) => r.status === "pendiente")) lote.status = "finalizado";
        await saveLote(lote);
        return;
      }

      // Resuelve cada fila contra el catalogo y construye su aporte al trabajo.
      // Lo que falla aqui (producto, zona quieta) queda con error sin auditar,
      // igual que los 404/500 de `POST /api/labels`.
      const products = getProductRepository();
      const bloques: string[] = [];
      const enviables: { n: number; code: string; name: string; qty: number }[] = [];
      for (const fila of lote.rows) {
        if (fila.status !== "pendiente") continue;
        let product;
        try {
          product =
            (await products.findByCode(fila.code)) ??
            (await products.findByBarcode(fila.code));
        } catch (err) {
          fila.status = "error";
          fila.error = (err as Error).message;
          continue;
        }
        if (!product) {
          fila.status = "error";
          fila.error = `Codigo "${fila.code}" no esta en el catalogo`;
          continue;
        }
        const data: LabelData = {
          productName: product.name,
          barcode: product.barcode,
          price: product.price,
          reference: product.reference,
          businessName: settings.label.businessName,
        };
        const zona = barcodeZoneOf(template);
        const plan = zona ? planForZone(template, zona, product.barcode) : null;
        if (zona && plan?.printable) {
          const quiet = quietZoneDots(template, zona, plan);
          if (quiet < QUIET_FACTOR * zona.moduleWidth) {
            fila.status = "error";
            fila.error =
              `Fallo interno: el plan dijo que "${plan.data}" cabe, pero la zona quieta ` +
              `queda en ${quiet} dots y la norma pide ${QUIET_FACTOR * zona.moduleWidth}.`;
            continue;
          }
        }
        bloques.push(buildZplBatch(template, data, fila.qty, { mediaWidthDots }));
        enviables.push({ n: fila.n, code: product.code, name: product.name, qty: fila.qty });
      }

      // Todo fallo de validacion: no hay nada que enviar (0 spawns).
      if (bloques.length === 0) {
        recount(lote);
        lote.updatedAt = new Date().toISOString();
        if (!lote.rows.some((r) => r.status === "pendiente")) lote.status = "finalizado";
        await saveLote(lote);
        return;
      }

      // Pausa o cancelacion pedida mientras se resolvia: no se envia nada. Lo
      // validado con error se guarda; lo pendiente queda pendiente.
      const previo = await getLote(id);
      if (!previo || previo.status !== "en-curso") return;
      volcarResultados(lote, previo);
      if (!bloquesEnviablesPendientes(previo, enviables)) {
        recount(previo);
        previo.updatedAt = new Date().toISOString();
        await saveLote(previo);
        return;
      }

      const trabajo = aplicarOscuridad(bloques.join("\n"), settings.oscuridad ?? "");
      const transport = createPrinterTransport(settings.printer);
      let falloEnvio: string | null = null;
      try {
        const resultado = await transport.send(trabajo);
        if (!resultado.ok) falloEnvio = resultado.error ?? "la impresora no respondio";
      } catch (err) {
        falloEnvio = (err as Error).message;
      }

      for (const e of enviables) {
        const fila = lote.rows.find((r) => r.n === e.n);
        if (!fila) continue;
        if (!falloEnvio) {
          fila.status = "ok";
          delete fila.error;
          await auditarSinRomper({ code: e.code, name: e.name, qty: e.qty, mode: "normal", ok: true });
        } else {
          fila.status = "error";
          fila.error = falloEnvio;
          await auditarSinRomper({ code: e.code, name: e.name, qty: e.qty, mode: "normal", ok: false, error: falloEnvio });
        }
      }

      // El estado pudo cambiar (pausa/cancelacion) durante el unico envio: se
      // vuelca sobre lo fresco sin forzar `finalizado` si ya no esta en curso.
      const fresco = (await getLote(id)) ?? lote;
      volcarResultados(lote, fresco);
      recount(fresco);
      fresco.updatedAt = new Date().toISOString();
      if (fresco.status === "en-curso" && !fresco.rows.some((r) => r.status === "pendiente")) {
        fresco.status = "finalizado";
      }
      await saveLote(fresco);
      return;
    }

    // Camino raw: el ZPL opaco va verbatim, una copia por etiqueta pedida.
    const products = getProductRepository();
    const bloquesRaw: string[] = [];
    const enviablesRaw: { n: number; code: string; name: string; qty: number }[] = [];
    for (const fila of lote.rows) {
      if (fila.status !== "pendiente") continue;
      let product;
      try {
        product =
          (await products.findByCode(fila.code)) ??
          (await products.findByBarcode(fila.code));
      } catch (err) {
        fila.status = "error";
        fila.error = (err as Error).message;
        continue;
      }
      if (!product) {
        fila.status = "error";
        fila.error = `Codigo "${fila.code}" no esta en el catalogo`;
        continue;
      }
      bloquesRaw.push(Array.from({ length: Math.max(1, Math.floor(fila.qty)) }, () => rawZpl).join("\n"));
      enviablesRaw.push({ n: fila.n, code: product.code, name: product.name, qty: fila.qty });
    }
    if (bloquesRaw.length === 0) {
      recount(lote);
      lote.updatedAt = new Date().toISOString();
      if (!lote.rows.some((r) => r.status === "pendiente")) lote.status = "finalizado";
      await saveLote(lote);
      return;
    }
    const previoRaw = await getLote(id);
    if (!previoRaw || previoRaw.status !== "en-curso") return;
    volcarResultados(lote, previoRaw);
    if (!bloquesEnviablesPendientes(previoRaw, enviablesRaw)) {
      recount(previoRaw);
      previoRaw.updatedAt = new Date().toISOString();
      await saveLote(previoRaw);
      return;
    }
    const trabajoRaw = aplicarOscuridad(bloquesRaw.join("\n"), settings.oscuridad ?? "");
    const transportRaw = createPrinterTransport(settings.printer);
    let falloRaw: string | null = null;
    try {
      const resultado = await transportRaw.send(trabajoRaw);
      if (!resultado.ok) falloRaw = resultado.error ?? "la impresora no respondio";
    } catch (err) {
      falloRaw = (err as Error).message;
    }
    for (const e of enviablesRaw) {
      const fila = lote.rows.find((r) => r.n === e.n);
      if (!fila) continue;
      if (!falloRaw) {
        fila.status = "ok";
        delete fila.error;
        await auditarSinRomper({ code: e.code, name: e.name, qty: e.qty, mode: "normal", ok: true });
      } else {
        fila.status = "error";
        fila.error = falloRaw;
        await auditarSinRomper({ code: e.code, name: e.name, qty: e.qty, mode: "normal", ok: false, error: falloRaw });
      }
    }
    const frescoRaw = (await getLote(id)) ?? lote;
    volcarResultados(lote, frescoRaw);
    recount(frescoRaw);
    frescoRaw.updatedAt = new Date().toISOString();
    if (frescoRaw.status === "en-curso" && !frescoRaw.rows.some((r) => r.status === "pendiente")) {
      frescoRaw.status = "finalizado";
    }
    await saveLote(frescoRaw);
  } finally {
    ejecutando.delete(id);
  }
}

/** ¿Sigue pendiente al menos una fila enviable en el lote fresco? */
function bloquesEnviablesPendientes(
  fresco: Lote,
  enviables: { n: number }[],
): boolean {
  return enviables.some((e) => fresco.rows.find((r) => r.n === e.n)?.status === "pendiente");
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
