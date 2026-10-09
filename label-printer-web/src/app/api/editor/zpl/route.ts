import { NextResponse } from "next/server";
import { readSettings } from "@/lib/settings/settings.store";
import { templateForPrint } from "@/lib/labels/label-override.store";
import { getTemplate } from "@/lib/labels/templates.store";
import { buildZpl, problemaDeMedio } from "@/lib/labels/zpl.builder";
import { dotsFromMm } from "@/lib/labels/label.template";
import type { LabelData } from "@/lib/labels/label.types";

/**
 * `GET /api/editor/zpl`: el ZPL TEXTO real de la muestra actual.
 *
 * Es el mismo ZPL que dibuja el preview PNG, pero en texto: misma geometria
 * efectiva (`templateForPrint()`, o sea la activa con el override del editor
 * aplicado encima si es la 59x35) y mismo producto de muestra que el preview
 * del editor (`productName`/`barcode`/`price` por query, con los mismos
 * valores por defecto que los Datos de prueba de `/editor`; `reference` fija
 * `"RETAIL"` y `businessName` el de ajustes, igual que el canvas).
 *
 * Si la activa es raw, devuelve su ZPL verbatim tal cual (no hay muestra que
 * aplicar: es ZPL opaco). Si no existe o el medio es mas estrecho que el
 * diseno, error honesto igual que el preview PNG.
 *
 * LO QUE NO HAY, A PROPOSITO (recorte documentado):
 *
 * - Sin parametros de cabezal ni densidad (`~SD`): no son verificables sin el
 *   hardware delante y la app es GX420 exclusiva sin telemetria. Exponer un
 *   numero que nadie puede comprobar seria inventar control.
 * - Sin RFID, sin modo invertido, sin "simulacion termica": el preview PNG ya
 *   es el ZPL real dibujado (`renderLabel()` sobre `buildZpl()`), no una
 *   aproximacion que haya que simular.
 *
 * Respuesta 200 `text/plain` (`^XA ... ^XZ`); errores como JSON `{ error }`.
 */
export const dynamic = "force-dynamic";

const MUESTRA_POR_DEFECTO: { productName: string; barcode: string; price: number; reference: string } = {
  productName: "BADIA JALAPEÑO 2 OZ",
  barcode: "033844007522",
  price: 5.68,
  reference: "RETAIL",
};

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const productName = params.get("productName")?.trim() || MUESTRA_POR_DEFECTO.productName;
  const barcode = params.get("barcode")?.trim() || MUESTRA_POR_DEFECTO.barcode;
  const priceParam = params.get("price")?.trim() || "";
  let price = MUESTRA_POR_DEFECTO.price;
  if (priceParam !== "") {
    price = Number(priceParam);
    if (!Number.isFinite(price)) {
      return NextResponse.json(
        { error: `El precio "${priceParam}" no es un numero: no hay muestra que construir.` },
        { status: 400 },
      );
    }
  }

  const settings = await readSettings();

  // Raw: no hay geometria ni muestra que aplicar. Se sirve el ZPL tal cual,
  // que es el dato real, con cabecera que dice su procedencia.
  const stored = await getTemplate(settings.label.templateId);
  if (stored && stored.kind === "raw" && stored.zpl) {
    return new Response(stored.zpl, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Zpl-Origen": "raw-verbatim",
      },
    });
  }

  let template: Awaited<ReturnType<typeof templateForPrint>>;
  try {
    template = await templateForPrint();
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  }

  // La misma comprobacion que antes de gastar papel: con un medio mas estrecho
  // que la etiqueta, `^PW` recorta en silencio y el texto mentiria igual que
  // mentiria el PNG.
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
    productName,
    barcode,
    price,
    reference: MUESTRA_POR_DEFECTO.reference,
    businessName: settings.label.businessName,
  };

  return new Response(buildZpl(template, data), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Zpl-Origen": "construido-muestra",
    },
  });
}
