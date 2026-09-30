import { NextResponse } from "next/server";
import { readSettings } from "@/lib/settings/settings.store";
import { buildLabelTemplate } from "@/lib/labels/label.template";
import { buildZplBatch, barcodeZoneOf, planForZone, quietZoneDots } from "@/lib/labels/zpl.builder";
import { createPrinterTransport } from "@/lib/printing/printer.transport";
import { createRequestLedger } from "@/lib/printing/request.ledger";

/** Solicitudes ya procesadas, para no imprimir dos veces la misma (E22). */
const requests = createRequestLedger();
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
    // La UI envia el codigo interno. Un barcode solo se acepta si identifica a UN producto:
    // con uno repetido, quedarse con el primero imprimiria el otro precio sin avisar.
    const porBarcode = await products.findAllByBarcode(input.productCode);
    product =
      (await products.findByCode(input.productCode)) ??
      (porBarcode.length === 1 ? porBarcode[0] : null);
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

  let settings;
  try {
    settings = await readSettings();
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
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
  // La plantilla sale de las medidas guardadas en /settings, no de una constante: antes se
  // podian cambiar y la etiqueta seguia saliendo de 50 x 25.
  const template = buildLabelTemplate(settings.label);
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
    const minQuiet = 10 * barcodeZone.moduleWidth;
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

  const zpl = buildZplBatch(template, data, input.qty);
  const transport = createPrinterTransport(settings.printer);
  // Con `requestId`, una solicitud repetida no vuelve a imprimir (E22, request.ledger.ts).
  const result = input.requestId
    ? await requests.run(input.requestId, () => transport.send(zpl))
    : await transport.send(zpl);

  if (result.duplicate) {
    // Nada se envio ahora: no se registra otra impresion en el historial.
    return NextResponse.json(
      result.ok
        ? { ok: true, duplicate: true, qty: input.qty, product, avisos }
        : { ok: false, duplicate: true, uncertain: result.uncertain, error: result.error },
      { status: result.ok ? 200 : 502 },
    );
  }

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
    return NextResponse.json({ error: result.error, uncertain: result.uncertain }, { status: 502 });
  }

  // El papel ya salio. Si el registro del historial falla (disco lleno, permisos) la
  // impresion sigue siendo un exito: se avisa por consola, pero no se le devuelve un
  // error al operador que ya tiene la etiqueta en la mano.
  const record = await safeAudit({ ...auditBase, ok: true, spoolerJobId: result.spoolerJobId });

  return NextResponse.json({
    ok: true,
    printedAt: record?.ts ?? new Date().toISOString(),
    jobId: record?.jobId,
    spoolerJobId: result.spoolerJobId,
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
