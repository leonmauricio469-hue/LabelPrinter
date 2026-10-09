import { NextResponse } from "next/server";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  templateById,
  type BarcodeZone,
  type LabelTemplate,
  type TextZone,
} from "@/lib/labels/label.template";
import { renderLabel } from "@/lib/labels/label.render";
import { resolveZoneText, planForZone } from "@/lib/labels/zpl.builder";
import type { LabelData } from "@/lib/labels/label.types";
import { zoneSchema } from "@/lib/labels/label-zones.schema";
import { readOverride } from "@/lib/labels/label-override.store";
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

/**
 * Plantilla vigente: la del codigo con el override aplicado encima.
 *
 * Es la misma funcion que usa la ruta de impresion, y se reutiliza aqui a proposito: si el
 * preview dibujara la del codigo y la impresora usara la otra, el editor ensenaria una
 * etiqueta que no es la que sale.
 */
async function plantillaVigente(): Promise<LabelTemplate> {
  const o = await readOverride();
  const base = templateById(o?.templateId);
  if (!o || o.templateId !== base.id) return base;
  return {
    ...base,
    zones: o.zones,
    zonesWithoutBarcode: o.zonesWithoutBarcode ?? base.zonesWithoutBarcode,
  };
}

/** Los productos reales del catalogo, para probar con nombres de verdad y no de mentira. */
export async function GET() {
  const products = await getProductRepository().list();
  const muestra = products
    .filter((p) => p.barcode && p.barcode !== "0")
    .slice(0, 400)
    .map((p) => ({ code: p.code, name: p.name, barcode: p.barcode, price: p.price }));
  const o = await readOverride();
  return NextResponse.json({
    productos: muestra,
    override: o ? { activo: true, templateId: o.templateId, savedAt: o.savedAt } : { activo: false },
    // Version REAL del package, para el pie del editor (F9): prohibido inventar
    // la del mockup. Si no se puede leer, `null` y la pantalla lo dice.
    version: versionReal(),
  });
}

/**
 * La version tal cual la dice `package.json`, sin adornos.
 *
 * Vive en este GET y no en un endpoint nuevo porque el editor ya lo pide al
 * abrir (muestras + override): un viaje mas para un string seria ruido.
 */
function versionReal(): string | null {
  try {
    const j = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      version?: unknown;
    };
    return typeof j.version === "string" && j.version !== "" ? j.version : null;
  } catch {
    return null;
  }
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

  // La base es la plantilla CON el override guardado, no la del codigo. Si se edita la
  // pantalla con un override activo y se recarga, hay que ver lo que se esta usando de verdad,
  // no la del `.ts`: dibujar sobre la base equivocada haria que el preview dijera una cosa y
  // la impresora otra, que es el fallo que este editor existe para evitar.
  const base = await plantillaVigente();
  const template: LabelTemplate = {
    ...base,
    zones: parsed.zones,
    zonesWithoutBarcode: parsed.zonesWithoutBarcode ?? base.zonesWithoutBarcode,
  };

  const data: LabelData = parsed.data;

  // Zona de producto para los metadatos del validador: la de `source:
  // "barcode"`, y si no hay (solo fijas), la primera de codigo. El plan se
  // calcula con el barcode de la muestra, igual que hace el render.
  const esBarcode = (z: (typeof template.zones)[number]): z is BarcodeZone =>
    z.kind === "barcode";
  const zonaPlan =
    template.zones.find((z): z is BarcodeZone => esBarcode(z) && z.source !== "fixed") ??
    template.zones.find(esBarcode);
  const planPlan = zonaPlan ? planForZone(template, zonaPlan, data.barcode) : null;

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
      // Metadatos del plan para el panel validador (F9): con que modulo y
      // cuantos modulos sale el simbolo de producto de la muestra. La zona que
      // manda es la de producto (`source: "barcode"`); si solo hay fijas, la
      // primera: el plan se calcula con el barcode de la muestra igual que el
      // render, asi que estos numeros son los del dibujo, no un supuesto.
      modulo: zonaPlan?.moduleWidth ?? 0,
      modulos: planPlan?.printable ? planPlan.modules : 0,
      // Symbologia DEL PLAN (la que decide, EAN-13 o Code 128): el `symbology`
      // del render es el ultimo simbolo emitido y con varias zonas de codigo
      // puede ser la fija; el validador ensena la del plan de producto.
      symPlan: planPlan?.printable ? planPlan.symbology : null,
      widthDots: template.widthDots,
      heightDots: template.heightDots,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}