import { NextResponse } from "next/server";
import { z } from "zod";
import {
  DEFAULT_TEMPLATE,
  type LabelTemplate,
  type LabelZone,
  type TextZone,
} from "@/lib/labels/label.template";
import { renderLabel } from "@/lib/labels/label.render";
import { resolveZoneText } from "@/lib/labels/zpl.builder";
import type { LabelData } from "@/lib/labels/label.types";
import { getProductRepository } from "@/lib/products/product.catalog.repository";

/**
 * `POST /api/editor/preview`
 *
 * Dibuja una etiqueta SIN imprimirla y SIN tocar `label.template.ts`.
 *
 * Por que el render va en el servidor y no en el navegador: `label.render.ts` dibuja el ZPL
 * que produce `buildZpl()`, y `buildZpl()` es el mismo que va a la impresora. Si el navegador
 * dibujara su propia version, el editor estaria enseñando una cosa e imprimiendo otra, que es
 * justo el fallo que hace inutil un editor de plantillas.
 *
 * El cuerpo son las zonas PROPUESTAS por el editor. Se aplican a una copia de la plantilla en
 * memoria y se dibuja esa. El fichero del codigo no se modifica nunca desde aqui.
 */

const zoneSchema: z.ZodType<LabelZone> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("text"),
      x: z.number(),
      y: z.number(),
      format: z.string(),
      source: z.string(),
      prefix: z.string().optional(),
      maxWidthDots: z.number().optional(),
      maxLines: z.number().optional(),
      justify: z.enum(["L", "C", "R"]).optional(),
      autoFit: z
        .object({ maxHeight: z.number(), minHeight: z.number(), widthRatio: z.number() })
        .optional(),
    }),
    z.object({
      kind: z.literal("barcode"),
      x: z.number(),
      y: z.number(),
      heightDots: z.number(),
      interpretationLine: z.boolean(),
      source: z.literal("barcode"),
      center: z.boolean().optional(),
      moduleWidth: z.number(),
      hriHeightDots: z.number().optional(),
    }),
    z.object({
      kind: z.literal("graphic"),
      x: z.number(),
      y: z.number(),
      gf: z.string(),
    }),
    z.object({
      kind: z.literal("shape"),
      x: z.number(),
      y: z.number(),
      widthDots: z.number(),
      heightDots: z.number(),
      thicknessDots: z.number(),
      radiusDots: z.number().optional(),
    }),
  ]),
) as z.ZodType<LabelZone>;

const bodySchema = z.object({
  zones: z.array(zoneSchema),
  zonesWithoutBarcode: z.array(zoneSchema).optional(),
  data: z.object({
    productName: z.string().default("CAFE AMANECER DE 500GR"),
    barcode: z.string().default("7591234567801"),
    price: z.number().default(7.8),
    reference: z.string().default("0001"),
    businessName: z.string().default("PA PICAR"),
  }),
  scale: z.number().int().min(1).max(8).default(3),
});

/** Los productos reales del catalogo, para probar con nombres de verdad y no de mentira. */
export async function GET() {
  const products = await getProductRepository().list();
  const muestra = products
    .filter((p) => p.barcode && p.barcode !== "0")
    .slice(0, 400)
    .map((p) => ({ code: p.code, name: p.name, barcode: p.barcode, price: p.price }));
  return NextResponse.json({ productos: muestra });
}

export async function POST(req: Request) {
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: `zonas invalidas: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  // Copia superficial: el objeto del codigo no se toca. Las zonas vienen del cuerpo.
  const template: LabelTemplate = {
    ...DEFAULT_TEMPLATE,
    zones: parsed.zones,
    zonesWithoutBarcode: parsed.zonesWithoutBarcode ?? DEFAULT_TEMPLATE.zonesWithoutBarcode,
  };

  const data: LabelData = parsed.data;

  try {
    const r = renderLabel(template, data, { scale: parsed.scale });

    // Alto y ancho RESUELTOS por zona. Sin esto el editor solo podria enseñar el `format` de
    // la plantilla, que con `autoFit` no es el que se imprime: el ajuste lo baja si el texto
    // no cabe y ahi el numero del `format` es una fiction.
    const resueltos = template.zones.map((z, i) => {
      if (z.kind !== "text") return { indice: i, texto: null, alto: 0, ancho: 0 };
      const res = resolveZoneText(template, z as TextZone, data);
      return res
        ? { indice: i, texto: res.text, alto: res.alto, ancho: res.ancho }
        : { indice: i, texto: null, alto: 0, ancho: 0 };
    });

    return NextResponse.json({
      png: r.png.toString("base64"),
      resueltos,
      cajas: r.cajas,
      informe: r.informe,
      symbology: r.symbology,
      datosImpresos: r.datosImpresos,
      anchoSimbolo: r.anchoSimbolo,
      zonaQuieta: r.zonaQuieta,
      widthDots: template.widthDots,
      heightDots: template.heightDots,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}