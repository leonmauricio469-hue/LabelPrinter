import { NextResponse } from "next/server";
import { z } from "zod";
import { createRequire } from "node:module";
import {
  DEFAULT_TEMPLATE,
  dotsFromMm,
  templateById,
} from "@/lib/labels/label.template";
import { graphicDots } from "@/lib/labels/gf-graphic";
import { readOverride } from "@/lib/labels/label-override.store";

// `pngjs` no trae tipos propios: en vez de un `@types` solo para esto (otra
// dependencia que auditar) se carga con `require` y se declara aqui lo unico
// que se usa (`PNG.sync.read` + las tres propiedades que devuelve). Si la
// forma real no coincidiera, `PNG.sync.read` lanzaria y el 400 honesto lo diria.
const require = createRequire(import.meta.url);
const { PNG } = require("pngjs") as {
  PNG: {
    sync: { read(buffer: Buffer): { width: number; height: number; data: Buffer } };
  };
};
type PngLeido = { width: number; height: number; data: Buffer };

/**
 * `POST /api/editor/logo`: convierte un PNG del operador en un `^GFA` listo
 * para poner en una zona `graphic` (F9, decision del usuario: cambiar el logo
 * cuando lo necesite).
 *
 * QUE HACE
 *
 * Recibe `{ pngBase64, widthMm? }`, decodifica el PNG (con `pngjs`: si la
 * libreria faltara o no leyera, se rechaza honesto, NO se implementa un
 * decoder a mano), lo pasa a blanco y negro con umbral 128, lo reescala con
 * vecino mas proximo manteniendo la proporcion y devuelve
 * `{ ok, gf, wDots, hDots }`. La pantalla pone ese `gf` en la zona
 * seleccionada: a partir de ahi es un `gf` mas, sin trato especial en el
 * preview ni en el render (el render dibuja la zona `graphic` que haya).
 *
 * EL ANCHO POR DEFECTO ES EL DEL LOGO ACTUAL: sin `widthMm` se mide el primer
 * `graphic` de la plantilla vigente (override aplicado, igual que el preview)
 * y se conserva su ancho, con el alto por proporcion. Con `widthMm` manda el
 * pedido. En los dos casos el ancho se ajusta al multiplo de 8 que le toca,
 * porque el `^GFA` no admite otros (ver `scaleGraphic()`).
 *
 * EL UMBRAL ES 128, FIJO: un pixel con luminancia < 128 es tinta, lo demas es
 * papel. Sin dithering ni suavizado: la GX420t a 203 dpi solo sabe negro o
 * blanco, e interpolar daria grises que el firmware tendria que decidir.
 * La transparencia se compone sobre blanco (el papel es blanco): un pixel
 * transparente es papel, no tinta.
 *
 * RECHAZOS HONESTOS (400): no-PNG, base64 roto, mas de 2 MB, dimensiones
 * absurdas (0 o mas de 2000 px por lado), PNG ilegible y bitmap que saldria
 * en blanco. Nada de esto se guarda en ningun sitio: este endpoint no escribe,
 * solo convierte. Guardar es trabajo de Aplicar.
 */

const DOS_MB = 2 * 1024 * 1024;

const bodySchema = z.object({
  // En base64 pesa ~4/3 del binario: 4 MB de texto cubren los 2 MB de tope
  // con margen, y el tope real se comprueba sobre el binario decodificado.
  pngBase64: z.string().min(1).max(4_000_000),
  // Ancho pedido en mm. Sin el, el ancho del logo actual.
  widthMm: z.number().min(2).max(100).optional(),
});

/** Firma PNG: los 8 primeros bytes. Sin ellos no es un PNG, diga lo que diga. */
const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Ancho en dots del primer logo de la plantilla vigente, o del codigo si no hay. */
async function anchoLogoActual(): Promise<number> {
  try {
    const o = await readOverride();
    const base = templateById(o?.templateId);
    const zonas =
      o && o.templateId === base.id && Array.isArray(o.zones) ? o.zones : base.zones;
    const logo = zonas.find((z) => z.kind === "graphic");
    if (logo && logo.kind === "graphic") {
      const d = graphicDots(logo.gf).dots;
      if (d) return d.w;
    }
  } catch {
    // Si el override no se puede leer, el defecto es el del codigo. Es mejor
    // que un 500: convertir no depende de lo guardado.
  }
  const delCodigo = DEFAULT_TEMPLATE.zones.find((z) => z.kind === "graphic");
  if (delCodigo && delCodigo.kind === "graphic") {
    return graphicDots(delCodigo.gf).dots?.w ?? 216;
  }
  return 216;
}

export async function POST(req: Request) {
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: `peticion invalida: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  const limpio = parsed.pngBase64.replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(limpio)) {
    return NextResponse.json({ error: "no es base64 valido" }, { status: 400 });
  }
  let bin: Buffer;
  try {
    bin = Buffer.from(limpio, "base64");
  } catch {
    return NextResponse.json({ error: "no es base64 valido" }, { status: 400 });
  }
  if (bin.length === 0) {
    return NextResponse.json({ error: "vacio: no trae ningun byte" }, { status: 400 });
  }
  if (bin.length > DOS_MB) {
    return NextResponse.json(
      {
        error:
          `pesa ${(bin.length / 1024 / 1024).toFixed(2)} MB: maximo 2 MB. ` +
          `Reducelo (menos pixeles o mas compresion) y vuelve a intentarlo.`,
      },
      { status: 400 },
    );
  }
  if (bin.length < 8 || !bin.subarray(0, 8).equals(FIRMA_PNG)) {
    return NextResponse.json(
      { error: "no es un PNG (solo PNG, por la firma del fichero, no por la extension)" },
      { status: 400 },
    );
  }

  let png: PngLeido;
  try {
    png = PNG.sync.read(bin);
  } catch {
    return NextResponse.json(
      { error: "ilegible: `pngjs` no lo pudo decodificar (fichero corrupto o PNG no estandar)" },
      { status: 400 },
    );
  }
  const { width: wSrc, height: hSrc } = png;
  if (
    !Number.isFinite(wSrc) ||
    !Number.isFinite(hSrc) ||
    wSrc < 1 ||
    hSrc < 1 ||
    wSrc > 2000 ||
    hSrc > 2000
  ) {
    return NextResponse.json(
      { error: `dimensiones absurdas: ${wSrc} x ${hSrc} px (tope 2000 por lado)` },
      { status: 400 },
    );
  }

  const wPedido =
    parsed.widthMm === undefined ? await anchoLogoActual() : dotsFromMm(parsed.widthMm);
  if (!Number.isFinite(wPedido) || wPedido < 8 || wPedido > 4000) {
    return NextResponse.json(
      { error: `ancho pedido absurdo: ${wPedido} dots (minimo 8, maximo 4000)` },
      { status: 400 },
    );
  }
  // Proporcion conservada (vecino mas proximo, como `scaleGraphic`): el alto
  // sale del ancho, nunca al reves, para no deformar el dibujo.
  const hPedido = Math.max(4, Math.round((hSrc * wPedido) / wSrc));
  if (hPedido > 4000) {
    return NextResponse.json(
      { error: `el alto proporcional saldria en ${hPedido} dots (maximo 4000)` },
      { status: 400 },
    );
  }
  const bytesPerRow = Math.ceil(wPedido / 8);
  const wDots = bytesPerRow * 8;
  const hDots = hPedido;
  const totalBytes = bytesPerRow * hDots;

  const salida = new Array<number>(totalBytes).fill(0);
  let negros = 0;
  for (let y = 0; y < hDots; y++) {
    const ySrc = Math.min(hSrc - 1, Math.floor((y * hSrc) / hDots));
    for (let b = 0; b < bytesPerRow; b++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = b * 8 + bit;
        const xSrc = Math.min(wSrc - 1, Math.floor((x * wSrc) / wDots));
        const o = (ySrc * wSrc + xSrc) * 4;
        const r = png.data[o] ?? 255;
        const g = png.data[o + 1] ?? 255;
        const bl = png.data[o + 2] ?? 255;
        const a = png.data[o + 3] ?? 255;
        // Transparencia sobre blanco (el papel): lo transparente es papel.
        const fr = (r * a + 255 * (255 - a)) / 255;
        const fg = (g * a + 255 * (255 - a)) / 255;
        const fb = (bl * a + 255 * (255 - a)) / 255;
        const lum = 0.299 * fr + 0.587 * fg + 0.114 * fb;
        if (lum < 128) {
          byte |= 1 << (7 - bit);
          negros++;
        }
      }
      salida[y * bytesPerRow + b] = byte;
    }
  }

  if (negros === 0) {
    return NextResponse.json(
      { error: "sale en blanco: ningun pixel queda por debajo del umbral 128" },
      { status: 400 },
    );
  }

  const filas: string[] = [];
  for (let y = 0; y < hDots; y++) {
    let fila = "";
    for (let b = 0; b < bytesPerRow; b++) {
      fila += (salida[y * bytesPerRow + b] ?? 0).toString(16).toUpperCase().padStart(2, "0");
    }
    filas.push(fila);
  }

  return NextResponse.json({
    ok: true,
    gf: `^GFA,${totalBytes},${totalBytes},${bytesPerRow},${filas.join("\n")}\n^FS`,
    wDots,
    hDots,
    negros,
  });
}
