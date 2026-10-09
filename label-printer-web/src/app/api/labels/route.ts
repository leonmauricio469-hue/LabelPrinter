import { NextResponse } from "next/server";
import { z } from "zod";
import { readSettings } from "@/lib/settings/settings.store";
import { templateForPrint } from "@/lib/labels/label-override.store";
import { getTemplate } from "@/lib/labels/templates.store";
import { TEMPLATES } from "@/lib/labels/label.template";
import { buildZplBatch, barcodeZoneOf, planForZone, quietZoneDots, problemaDeMedio } from "@/lib/labels/zpl.builder";
import { dotsFromMm } from "@/lib/labels/label.template";
import { QUIET_FACTOR } from "@/lib/labels/barcode-plan";
import { createPrinterTransport } from "@/lib/printing/printer.transport";
import { getProductRepository } from "@/lib/products/product.catalog.repository";
import { appendPrintRecord, type PrintRecord } from "@/lib/audit/audit.store";
import { printRequestSchema } from "@/lib/validation/schemas";
import type { LabelData } from "@/lib/labels/label.types";
import type { Product } from "@/lib/products/product.types";

/**
 * `POST /api/labels`: como `printRequestSchema`, mas `templateId` opcional (F4).
 *
 * El schema vive aqui y no en `validation/schemas.ts` a proposito: ese archivo lo
 * compilan los scripts con `tsconfig.preview.json` y no se toca en F4. La extension es
 * aditiva: sin `templateId` el cuerpo valida igual que antes.
 */
const printWithTemplateSchema = printRequestSchema.extend({
  templateId: z.string().min(1).max(64).optional(),
});

type PrintWithTemplateInput = z.infer<typeof printWithTemplateSchema>;

/**
 * Ciclo de impresion completo, en el orden que fija [[Convenciones de Codigo]]:
 *
 *   validar (zod) -> buscar producto (repository) -> generar ZPL (builder)
 *   -> enviar (transport) -> registrar (audit) -> responder
 *
 * El request trae `productCode`, no los datos: el precio sale del catalogo, nunca del
 * cliente, para que no se pueda imprimir una etiqueta con un precio inventado.
 *
 * F4: `templateId` opcional. Sin el, comportamiento actual al milimetro (plantilla
 * activa de settings). Con el, esa plantilla de la biblioteca: si es estructurada, el
 * flujo es identico al actual con esa plantilla; si es raw, su ZPL se envia verbatim
 * por el mismo transporte y se audita con el `code` del producto igual (es impresion
 * real, no test).
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = printWithTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Solicitud invalida", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input: PrintWithTemplateInput = parsed.data;

  const products = getProductRepository();
  let product: Product | null;
  try {
    // El escaner entrega el barcode; el operador a veces teclea el codigo interno.
    product =
      (await products.findByCode(input.productCode)) ??
      (await products.findByBarcode(input.productCode));
  } catch (err) {
    // Un catalog.json corrupto es un 500 con el motivo, no un "producto no encontrado":
    // son dos fallos distintos y el operador debe poder distinguirlos.
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  if (!product) {
    return NextResponse.json(
      { error: `Codigo "${input.productCode}" no esta en el catalogo` },
      { status: 404 },
    );
  }

  const settings = await readSettings();

  // La plantilla sale de `settings.label.templateId`. Antes era `DEFAULT_TEMPLATE` fijo, y
  // `widthMm`/`heightMm` no los leia nadie: cambiar el tamano de etiqueta en /settings no
  // hacia nada.
  //
  // `templateForPrint()` es asincrona y cae en la de 59 x 35 mm si el id no existe, para que un
  // `settings.json` de antes de v1.3 (con `papicar-50x25`) siga imprimiendo en vez de tumbar
  // la ruta entera. Ademas aplica encima la geometria que se haya guardado desde `/editor`
  // (`data/plantilla-override.json`), que es como un cambio hecho en pantalla llega a la
  // impresora sin recompilar. Ver `label-override.store.ts`.
  //
  // F4: con `templateId` explicito no hay caida silenciosa: si no existe ni en la
  // biblioteca ni en el codigo, es 404. Sin el, la activa de settings, como siempre.
  const wantedId = input.templateId ?? settings.label.templateId;
  if (input.templateId) {
    const existe =
      (await getTemplate(input.templateId)) ??
      TEMPLATES.find((t) => t.id === input.templateId);
    if (!existe) {
      return NextResponse.json(
        { error: `La plantilla "${input.templateId}" no existe` },
        { status: 404 },
      );
    }
  }

  // Camino raw: la plantilla trae su ZPL opaco y se envia verbatim por el mismo
  // transporte. No hay construccion, ni adaptacion, ni vista previa: lo que hay en el
  // archivo es lo que sale. Se audita con el `code` del producto igual que una
  // impresion estructurada, porque papel gastado es historial.
  const rawTemplate = await getTemplate(wantedId);
  if (rawTemplate && rawTemplate.kind === "raw" && rawTemplate.zpl) {
    return await printRaw(settings, product, input, rawTemplate.zpl, rawTemplate.name, rawTemplate.widthMm);
  }

  const template = await templateForPrint(wantedId);

  // El medio tiene que admitir el diseño, y esto se comprueba ANTES de construir el ZPL.
  //
  // Se podría comprobar despues, mirando el ZPL, y no se comprueba asi a proposito: el ZPL
  // no dice que ha recortado. `^PW` lleva el numero del medio y el resto de comandos llevan
  // coordenadas del diseño, y que los dos no cuadren es cosa de quien los lee, no de la
  // impresora. La impresora no protesta, el trabajo sale de la cola como entregado, y la
  // etiqueta llega al papel con el lado derecho cortado.
  //
  // Un 422 con el numero que hay que cambiar es la unica forma de que esto se entere antes de
  // gastar papel. Ver `problemaDeMedio()`.
  const mediaWidthDots = dotsFromMm(settings.printer.mediaWidthMm);
  const problemaMedio = problemaDeMedio(template, mediaWidthDots);
  if (problemaMedio) {
    return NextResponse.json(
      {
        error: `No se imprime: ${problemaMedio}`,
        medio: {
          mediaWidthMm: settings.printer.mediaWidthMm,
          disenoWidthMm: template.widthMm,
        },
      },
      { status: 422 },
    );
  }

  const data: LabelData = {
    productName: product.name,
    barcode: product.barcode,
    price: product.price,
    reference: product.reference,
    businessName: settings.label.businessName,
  };

  // Antes de gastar papel se resuelve que symbologia lleva este codigo en esta etiqueta.
  // Antes esto era un 422, y con el catalogo real eso habria sido un error en el 62% de los
  // productos. No lo es: un UPC-A, un codigo alfanumerico o un codigo que no cabe son datos
  // del sistema de origen, no un fallo de quien pulsa. Se imprime igual y se avisa.
  const barcodeZone = barcodeZoneOf(template);
  const plan = barcodeZone ? planForZone(template, barcodeZone, product.barcode) : null;

  const avisos: string[] = [];
  if (plan?.printable && plan.correctedFrom) {
    avisos.push(
      `El codigo "${product.barcode}" tiene el digito de control mal. Se imprime como ` +
        `${plan.data}, que es el correcto. El original esta mal en el sistema de origen.`,
    );
  }
  if (plan && !plan.printable) {
    avisos.push(`Esta etiqueta sale SIN codigo de barras: ${plan.detail}`);
  }

  // Comprobacion de defensa: `planBarcode()` ya garantiza la zona quieta por construccion,
  // asi que aqui solo se verifica que nadie haya roto esa garantia cambiando el centro o el
  // ancho de modulo de la plantilla. Si salta, es un fallo interno y se responde 500 con el
  // motivo: un 422 diria al operador que su codigo esta mal, y no es verdad.
  if (barcodeZone && plan?.printable) {
    const quiet = quietZoneDots(template, barcodeZone, plan);
    const minQuiet = QUIET_FACTOR * barcodeZone.moduleWidth;
    if (quiet < minQuiet) {
      return NextResponse.json(
        {
          error:
            `Fallo interno: el plan dijo que "${plan.data}" cabe, pero la zona quieta ` +
            `queda en ${quiet} dots y la norma pide ${minQuiet}. La plantilla y ` +
            `\`planBarcode()\` han dejado de estar de acuerdo.`,
        },
        { status: 500 },
      );
    }
  }

  const zpl = buildZplBatch(template, data, input.qty, { mediaWidthDots });
  const transport = createPrinterTransport(settings.printer);
  const result = await transport.send(zpl);

  const auditBase = {
    code: product.code,
    name: product.name,
    qty: input.qty,
    mode: input.mode,
  } as const;

  if (!result.ok) {
    // Un fallo de impresion tambien se registra: sin esto, el historial solo diria
    // "imprimio bien" y noaria falta de las veces que la impresora no respondio.
    await safeAudit({ ...auditBase, ok: false, error: result.error });
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // El papel ya salio. Si el registro del historial falla (disco lleno, permisos) la
  // impresion sigue siendo un exito: se avisa por consola, pero no se le devuelve un
  // error al operador que ya tiene la etiqueta en la mano.
  const record = await safeAudit({ ...auditBase, ok: true });

  return NextResponse.json({
    ok: true,
    printedAt: record?.ts ?? new Date().toISOString(),
    jobId: record?.jobId,
    qty: input.qty,
    product,
    barcode: plan?.printable
      ? { symbology: plan.symbology, data: plan.data, modules: plan.modules }
      : null,
    avisos,
  });
}

/**
 * Imprime una plantilla raw: su ZPL verbatim, una copia por etiqueta pedida.
 *
 * Cada copia es el bloque tal cual (los bloques `^XA ... ^XZ` los delimita la Zebra,
 * igual que en `buildZplBatch()`). La unica comprobacion es la del medio, con el ancho
 * declarado de la plantilla: un ZPL opaco tambien se recorta en silencio con `^PW`.
 * Sin `barcode` en la respuesta (no hay plan: no se sabe ni la symbologia) y con un
 * aviso que lo dice, para que nadie confunda "salio" con "salio adaptada".
 */
async function printRaw(
  settings: Awaited<ReturnType<typeof readSettings>>,
  product: Product,
  input: PrintWithTemplateInput,
  zpl: string,
  templateName: string,
  widthMm: number,
) {
  const mediaWidthDots = dotsFromMm(settings.printer.mediaWidthMm);
  if (mediaWidthDots < dotsFromMm(widthMm)) {
    return NextResponse.json(
      {
        error:
          `No se imprime: el medio cargado mide ${settings.printer.mediaWidthMm} mm y la ` +
          `plantilla "${templateName}" mide ${widthMm} mm. Con un medio mas estrecho que la ` +
          `etiqueta, ^PW recorta y no escala: la etiqueta saldria cortada por la derecha, en silencio.`,
        medio: {
          mediaWidthMm: settings.printer.mediaWidthMm,
          disenoWidthMm: widthMm,
        },
      },
      { status: 422 },
    );
  }

  const trabajo = Array.from({ length: input.qty }, () => zpl).join("\n");
  const transport = createPrinterTransport(settings.printer);
  const result = await transport.send(trabajo);

  const auditBase = {
    code: product.code,
    name: product.name,
    qty: input.qty,
    mode: input.mode,
  } as const;

  if (!result.ok) {
    await safeAudit({ ...auditBase, ok: false, error: result.error });
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const record = await safeAudit({ ...auditBase, ok: true });

  return NextResponse.json({
    ok: true,
    printedAt: record?.ts ?? new Date().toISOString(),
    jobId: record?.jobId,
    qty: input.qty,
    product,
    barcode: null,
    avisos: [
      `La plantilla "${templateName}" es ZPL directo (raw): se envio tal cual, sin adaptacion ni vista previa.`,
    ],
  });
}

/** Registra la impresion sin propagar el fallo: el papel ya salio, el historial es un extra. */
async function safeAudit(
  entry: Parameters<typeof appendPrintRecord>[0],
): Promise<PrintRecord | null> {
  try {
    return await appendPrintRecord(entry);
  } catch (err) {
    console.error("No se pudo escribir en print-history.jsonl:", (err as Error).message);
    return null;
  }
}
