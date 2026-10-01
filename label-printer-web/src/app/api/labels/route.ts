import { NextResponse } from "next/server";
import { readSettings } from "@/lib/settings/settings.store";
import { templateForPrint } from "@/lib/labels/label-override.store";
import { buildZplBatch, barcodeZoneOf, planForZone, quietZoneDots, problemaDeMedio } from "@/lib/labels/zpl.builder";
import { dotsFromMm } from "@/lib/labels/label.template";
import { QUIET_FACTOR } from "@/lib/labels/barcode-plan";
import { createPrinterTransport } from "@/lib/printing/printer.transport";
import { getProductRepository } from "@/lib/products/product.catalog.repository";
import { appendPrintRecord, type PrintRecord } from "@/lib/audit/audit.store";
import { printRequestSchema, type PrintRequestInput } from "@/lib/validation/schemas";
import type { LabelData } from "@/lib/labels/label.types";
import type { Product } from "@/lib/products/product.types";

/**
 * Ciclo de impresion completo, en el orden que fija [[Convenciones de Codigo]]:
 *
 *   validar (zod) -> buscar producto (repository) -> generar ZPL (builder)
 *   -> enviar (transport) -> registrar (audit) -> responder
 *
 * El request trae `productCode`, no los datos: el precio sale del catalogo, nunca del
 * cliente, para que no se pueda imprimir una etiqueta con un precio inventado.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = printRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Solicitud invalida", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input: PrintRequestInput = parsed.data;

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
  const template = await templateForPrint(settings.label.templateId);

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
