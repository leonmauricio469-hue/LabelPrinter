import { NextResponse } from "next/server";
import { readSettings } from "@/lib/settings/settings.store";
import { templateForPrint } from "@/lib/labels/label-override.store";
import { barcodeZoneOf, planForZone, problemaDeMedio, quietZoneDots } from "@/lib/labels/zpl.builder";
import { dotsFromMm } from "@/lib/labels/label.template";
import { QUIET_FACTOR } from "@/lib/labels/barcode-plan";
import { renderLabel } from "@/lib/labels/label.render";
import { getProductRepository } from "@/lib/products/product.catalog.repository";
import type { LabelData } from "@/lib/labels/label.types";
import type { Product } from "@/lib/products/product.types";

/**
 * `GET /api/labels/preview?code=<productCode>`
 *
 * Dibuja la etiqueta SIN imprimirla y SIN registrarla en el historial.
 *
 * Resuelve el producto EXACTAMENTE igual que `POST /api/labels` (primero por
 * codigo interno, luego por barcode) y con la MISMA plantilla
 * (`templateForPrint()`, que aplica el override de `/editor` si lo hay), para
 * que el PNG sea el mismo ZPL que saldria por la impresora. `renderLabel()`
 * dibuja el ZPL que produce `buildZpl()`, no una geometria aparte, asi que no
 * hay dos medidas que puedan desincronizarse.
 *
 * Respuestas:
 *
 * - 200 `image/png` cuando el producto existe (tambien cuando su codigo no es
 *   imprimible: igual que al imprimir, sale la variante sin barras, no un
 *   error).
 * - 404 cuando el codigo no esta en el catalogo, con el mismo mensaje que al
 *   imprimir.
 * - 422 cuando el medio cargado es mas estrecho que el diseño, igual que al
 *   imprimir (`^PW` recortaria en silencio).
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code")?.trim() ?? "";
  if (!code) {
    return NextResponse.json({ error: 'Falta el parametro "code"' }, { status: 400 });
  }

  const products = getProductRepository();
  let product: Product | null;
  try {
    // El mismo lookup que `POST /api/labels`: el escaner entrega el barcode y el
    // operador a veces teclea el codigo interno. Que la pantalla muestre un
    // producto y la impresora saque otro seria el peor fallo posible.
    product =
      (await products.findByCode(code)) ?? (await products.findByBarcode(code));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  if (!product) {
    return NextResponse.json(
      { error: `Codigo "${code}" no esta en el catalogo` },
      { status: 404 },
    );
  }

  const settings = await readSettings();
  const template = await templateForPrint(settings.label.templateId);

  // La misma comprobacion que antes de gastar papel: con un medio mas estrecho
  // que la etiqueta, `^PW` recorta en silencio y el PNG mentiria mostrando una
  // etiqueta entera que en papel saldria cortada.
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

  // La misma defensa que en la ruta de impresion: si el plan dijo que cabe pero
  // la zona quieta no da, la plantilla y `planBarcode()` dejaron de estar de
  // acuerdo y el PNG no seria lo que sale. Es un fallo interno, no del codigo.
  const barcodeZone = barcodeZoneOf(template);
  const plan = barcodeZone ? planForZone(template, barcodeZone, product.barcode) : null;
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

  const r = renderLabel(template, data);

  return new NextResponse(new Uint8Array(r.png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      // Cache corto: el PNG depende del catalogo, los settings y el override,
      // que cambian sin aviso.
      "Cache-Control": "public, max-age=60",
    },
  });
}
