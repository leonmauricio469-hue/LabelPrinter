import { deflateSync } from "node:zlib";
import { buildZpl, symbolDots, quietZoneDots, barcodeZoneOf, planForZone } from "./zpl.builder";
import { LOGO_DOTS_W, LOGO_DOTS_H } from "./pa-picar-logo";
import type { LabelData } from "./label.types";
import type { LabelTemplate, BarcodeZone } from "./label.template";
import { encodeCode128Auto } from "./code128";
import { EAN13_MODULES } from "./ean13";

/**
 * Dibuja una etiqueta a PNG, a la resolucion real de la impresora.
 *
 * ESTA ES LA PIEZA QUE COMPARTEN `scripts/render-label.ts` y `/editor`.
 *
 * Lo importante es que dibuja el ZPL que produce `buildZpl()`, no una aproximacion hecha a
 * mano desde los numeros de la plantilla. Si alguien cambia una zona, el PNG sale como sale
 * el ZPL; si el PNG queda bien, el ZPL esta bien. Un renderizador aparte, dibujando cada
 * elemento por su cuenta, daria verde en verde con dos medidas distintas.
 *
 * Sale del ZPL.parseando linea a linea (`^FO`, `^A0`, `^FB`, `^BY`, `^BC`/`^BE`, `^FD`),
 * que es lo que hace el firmware de verdad y no una lectura de la plantilla.
 */

const FONT: Record<string, string> = {
  "0": "25552", "1": "26227", "2": "71747", "3": "71717", "4": "55711",
  "5": "74717", "6": "74757", "7": "71111", "8": "75757", "9": "75717",
  A: "75755", B: "65656", C: "74447", D: "65556", E: "74647",
  F: "74644", G: "74557", H: "55755", I: "72227", J: "11157",
  K: "55655", L: "44447", M: "57755", N: "57775", O: "75557",
  P: "75744", Q: "75711", R: "75655", S: "74717", T: "72222",
  U: "55557", V: "55552", W: "55775", X: "55255", Y: "55722",
  Z: "71247", " ": "00000", $: "27272", ".": "00001", ",": "00024",
  "-": "00700", _: "00007", "/": "11244", "&": "52536", ":": "02020",
  "#": "57575", "(": "24442", ")": "41114", "+": "02720", "!": "22202",
  "?": "71202", "*": "52252", "%": "56215",
};

export interface RenderedZone {
  etiqueta: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Texto tal y como sale en `^FD`, ya plegado a ASCII. */
  texto?: string;
  /** Alto de fuente resuelto (el de `autoFit` si la zona lo tiene, si no el de `format`). */
  alto?: number;
  anchoUsado?: number;
}

export interface RenderResult {
  png: Buffer;
  /** Cajas de todo lo dibujado, en dots. Es lo que usa la UI para colocar los campos. */
  cajas: RenderedZone[];
  /** Linea de la consola de `render-label`, por si el editor la quiere teach. */
  informe: string[];
  symbology: "ean13" | "code128" | null;
  /** Datos que realmente se imprimen, que no son siempre los del producto. */
  datosImpresos: string | null;
  anchoSimbolo: number;
  zonaQuieta: number;
}

/**
 * Ancho que ocupa un texto, en dots.
 *
 * En ZPL, `^A0N,alto,ancho` hace que CADA CARACTER ocupe `ancho` dots: el ancho es el avance
 * de la celda, no el ancho del glifo. Aqui se dibujo el glifo de 3 columnas repartido dentro
 * de una celda de `wDot`, con una separacion proportional, y el avance es `wDot` clavado.
 *
 * Importa porque `resolveAutoFit()` en `zpl.builder.ts` calcula el ajuste con
 * `caracteres * ancho <= maxWidthDots`: si el renderer midiera distinto, las cajas que ve el
 * editor no cuadrarian con el ajuste que decide el alto de letra, y aparecerian solapes que
 * en papel no existen.
 */
export function textBox(text: string, xDot: number, yDot: number, hDot: number, wDot: number) {
  const used = text.length * wDot;
  return { x0: xDot, y0: yDot, x1: xDot + used, y1: yDot + hDot };
}

export function renderLabel(
  template: LabelTemplate,
  data: LabelData,
  opts: { scale?: number; grid?: boolean } = {},
): RenderResult {
  const SCALE = Math.max(1, Math.min(8, opts.scale ?? 3));
  const GRID_ON = opts.grid ?? true;

  const widthDots = template.widthDots;
  const heightDots = template.heightDots;
  const W = widthDots * SCALE;
  const H = heightDots * SCALE;
  const px = Buffer.alloc(W * H * 3, 0xff);

  type Rgb = [number, number, number];
  const BLACK: Rgb = [0, 0, 0];
  const TEXT: Rgb = [70, 70, 70];
  const GRID: Rgb = [228, 228, 228];
  const EDGE: Rgb = [255, 55, 55];
  const FB: Rgb = [150, 195, 255];
  const OKEDGE: Rgb = [0, 150, 0];
  const BADEDGE: Rgb = [225, 45, 45];

  const informe: string[] = [];
  const cajas: RenderedZone[] = [];

  function rect(xDot: number, yDot: number, wDot: number, hDot: number, c: Rgb) {
    const x0 = xDot * SCALE;
    const y0 = yDot * SCALE;
    const w = wDot * SCALE;
    const h = hDot * SCALE;
    for (let y = y0; y < y0 + h; y++) {
      if (y < 0 || y >= H) continue;
      for (let x = x0; x < x0 + w; x++) {
        if (x < 0 || x >= W) continue;
        const i = (y * W + x) * 3;
        px[i] = c[0];
        px[i + 1] = c[1];
        px[i + 2] = c[2];
      }
    }
  }
  const vLine = (x: number, y0: number, y1: number, c: Rgb) => rect(x, y0, 1, Math.max(1, y1 - y0), c);
  const hLine = (x0: number, x1: number, y: number, c: Rgb) => rect(x0, y, Math.max(1, x1 - x0), 1, c);

  /**
   * Dibuja `text` con celdas de `wDot` de ancho y `hDot` de alto. Devuelve el ancho usado.
   *
   * El glifo de 3 columnas se reparte dentro de la celda: `celda = wDot / 3`, con la
   * separacion proporcional. El avance es `wDot` exacto, que es lo que significa el ancho en
   * `^A0N,alto,ancho` y lo que mide `resolveAutoFit()`.
   */
  function drawText(xDot: number, yDot: number, hDot: number, wDot: number, text: string, c: Rgb): number {
    const cw = Math.max(1, Math.floor(wDot / 3));
    const gap = Math.max(0, Math.floor((wDot - cw * 3) / 2));
    const rowH = Math.max(1, Math.floor(hDot / 5));
    let cx = xDot;
    for (const ch of text) {
      const glyph = FONT[ch.toUpperCase()] ?? FONT["?"];
      for (let ry = 0; ry < 5; ry++) {
        const bits = glyph.charCodeAt(ry) - 48;
        for (let rx = 0; rx < 3; rx++) {
          if (bits & (4 >> rx)) {
            rect(cx + rx * cw + gap, yDot + ry * rowH, cw, rowH, c);
          }
        }
      }
      cx += wDot;
    }
    return cx - xDot;
  }

  function drawGraphic(gf: string, xDot: number, yDot: number) {
    const m = gf.match(/\^GFA,(\d+),(\d+),(\d+),([\s\S]*)/);
    if (!m) return;
    const bytesPerRow = Number.parseInt(m[3], 10);
    const hex = m[4].replace(/[^0-9a-fA-F]/g, "");
    const bytes: number[] = [];
    for (let i = 0; i + 1 < hex.length; i += 2) bytes.push(Number.parseInt(hex.slice(i, i + 2), 16));
    for (let r = 0; r * bytesPerRow < bytes.length; r++) {
      for (let b = 0; b < bytesPerRow; b++) {
        const v = bytes[r * bytesPerRow + b];
        if (v === undefined) break;
        for (let bit = 0; bit < 8; bit++) {
          if (v & (1 << (7 - bit))) rect(xDot + b * 8 + bit, yDot + r, 1, 1, BLACK);
        }
      }
    }
  }

  function quietOk(x: number, right: number, moduleW: number) {
    return right <= widthDots && x >= 10 * moduleW && widthDots - right >= 10 * moduleW;
  }

  function drawEan13(text: string, xDot: number, yDot: number, hDot: number, moduleW: number) {
    const total = EAN13_MODULES * moduleW;
    for (let m = 0; m < EAN13_MODULES; m++) {
      const inGuard = m < 3 || (m >= 45 && m < 50) || m >= 92;
      const on = inGuard ? m % 2 === 0 : (m * 7 + 3) % 3 !== 0;
      if (on) rect(xDot + m * moduleW, yDot, moduleW, hDot, BLACK);
    }
    const hriH = 12;
    const hri = textBox(text, xDot, yDot + hDot + 2, hriH, 7);
    drawText(xDot, yDot + hDot + 2, hriH, 7, text, TEXT);
    const right = xDot + total;
    const ok = quietOk(xDot, right, moduleW);
    vLine(right, yDot, yDot + hDot, ok ? OKEDGE : BADEDGE);
    informe.push(
      `EAN-13: ${EAN13_MODULES} mod x ${moduleW} = ${total} dots (${(total / 8).toFixed(1)} mm)` +
        `  x ${xDot}..${right}  quieta ${xDot}/${widthDots - right} dots` +
        ` (${(xDot / 8).toFixed(2)}/${((widthDots - right) / 8).toFixed(2)} mm, min 10X = ${(10 * moduleW / 8).toFixed(2)} mm)  ${ok ? "OK" : "FALLA"}`,
    );
    cajas.push({ etiqueta: "barras", x0: xDot, y0: yDot, x1: right, y1: hri.y1 });
    return { total, right, ok };
  }

  function drawCode128(text: string, xDot: number, yDot: number, hDot: number, moduleW: number) {
    const { encoded, note } = encodeCode128Auto(text);
    const total = encoded.modules * moduleW;
    let cx = xDot;
    let bar = true;
    for (const w of encoded.widths) {
      if (bar) rect(cx, yDot, w * moduleW, hDot, BLACK);
      cx += w * moduleW;
      bar = !bar;
    }
    const hriH = 12;
    const hri = textBox(text, xDot, yDot + hDot + 2, hriH, 7);
    drawText(xDot, yDot + hDot + 2, hriH, 7, text, TEXT);
    const right = xDot + total;
    const ok = quietOk(xDot, right, moduleW);
    vLine(right, yDot, yDot + hDot, ok ? OKEDGE : BADEDGE);
    informe.push(
      `CODE 128 automatico (${note}): ${encoded.modules} mod x ${moduleW} = ${total} dots (${(total / 8).toFixed(1)} mm)` +
        `  x ${xDot}..${right}  quieta ${xDot}/${widthDots - right} dots  ${ok ? "OK" : "FALLA"}`,
    );
    cajas.push({ etiqueta: "barras", x0: xDot, y0: yDot, x1: right, y1: hri.y1 });
    return { total, right, ok };
  }

  // ------------------------------------------------------------------ lienzo de fondo
  if (GRID_ON) {
    for (let d = 0; d <= widthDots; d += 8) vLine(d, 0, H, GRID);
    for (let d = 0; d <= heightDots; d += 8) hLine(0, W, d, GRID);
  }
  vLine(widthDots - 1, 0, H, EDGE);
  hLine(0, W, heightDots - 1, EDGE);

  const zpl = buildZpl(template, data);
  const { zones } = (function () {
    // `resolveLabel` no se exporta con esa forma; se re-resuelve por el camino del builder
    // para no duplicar la eleccion de zonas sin barras.
    const bz = barcodeZoneOf(template);
    const plan = bz ? planForZone(template, bz, data.barcode) : null;
    const sinCodigo = plan && !plan.printable && template.zonesWithoutBarcode;
    return { zones: sinCodigo ? template.zonesWithoutBarcode! : template.zones };
  })();

  // El ^GFA lleva saltos de linea internos: se saca del ZPL completo antes de trocear.
  const gfZone = zones.find((z) => z.kind === "graphic");
  const gfMatch = zpl.match(/\^GFA,[\s\S]*?\n\^FS/);
  if (gfMatch && gfZone && gfZone.kind === "graphic") {
    drawGraphic(gfMatch[0], gfZone.x, gfZone.y);
    informe.push(`logo ${LOGO_DOTS_W} x ${LOGO_DOTS_H} dots en ${gfZone.x},${gfZone.y}`);
    cajas.push({
      etiqueta: "logo",
      x0: gfZone.x,
      y0: gfZone.y,
      x1: gfZone.x + LOGO_DOTS_W,
      y1: gfZone.y + LOGO_DOTS_H,
    });
  }

  // ------------------------------------------------------------------- parseo del ZPL
  let curX = 0;
  let curY = 0;
  let fontH = 0;
  let fontW = 0;
  let byW = 2;
  let bcH = 0;
  let symbology: "ean13" | "code128" | null = null;
  let inBarcode = false;
  let datosImpresos: string | null = null;

  for (const raw of zpl.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("^XA") || line.startsWith("^XZ")) continue;
    if (line.startsWith("^PW") || line.startsWith("^LL") || line.startsWith("^LH")) continue;
    if (line.startsWith("^GFA")) continue;
    if (line.startsWith("^GB")) continue; // el marco no se dibuja: ensuciaria la previsualizacion

    if (line.startsWith("^FO")) {
      const [x, y] = line.slice(3).split(",").map(Number);
      curX = x;
      curY = y;
      continue;
    }
    if (line.startsWith("^A0")) {
      const p = line.slice(3).split(",");
      fontH = Number.parseInt(p[1], 10);
      fontW = Number.parseInt(p[2], 10);
      continue;
    }
    if (line.startsWith("^FB")) {
      const fbW = Number.parseInt(line.slice(3).split(",")[0], 10);
      vLine(curX + fbW, curY, curY + fontH, FB);
      continue;
    }
    if (line.startsWith("^BY")) {
      byW = Number.parseInt(line.slice(3).split(",")[0], 10);
      continue;
    }
    if (line.startsWith("^BC") || line.startsWith("^BE")) {
      bcH = Number.parseInt(line.slice(3).split(",")[1], 10);
      symbology = line.startsWith("^BE") ? "ean13" : "code128";
      inBarcode = true;
      continue;
    }
    if (line.startsWith("^FD")) {
      const text = line.slice(3).replace(/\^FS$/, "");
      if (inBarcode) {
        datosImpresos = text;
        if (symbology === "ean13") drawEan13(text, curX, curY, bcH, byW);
        else drawCode128(text, curX, curY, bcH, byW);
        inBarcode = false;
        continue;
      }
      const used = drawText(curX, curY, fontH, fontW, text, TEXT);
      const b = textBox(text, curX, curY, fontH, fontW);
      cajas.push({ etiqueta: "texto", texto: text, alto: fontH, anchoUsado: used, ...b });
      if (curX + used > widthDots) informe.push(`"${text}" SE PASA POR LA DERECHA (${curX + used} > ${widthDots})`);
      if (curY + fontH > heightDots) informe.push(`"${text}" SE PASA POR ABAJO (${curY + fontH} > ${heightDots})`);
      continue;
    }
  }

  // ------------------------------------------------------------------ comprobaciones
  const bz = barcodeZoneOf(template) as BarcodeZone | undefined;
  const plan = bz ? planForZone(template, bz, data.barcode) : null;
  const anchoSimbolo = bz && plan ? symbolDots(bz, plan) : 0;
  const zonaQuieta = bz && plan ? quietZoneDots(template, bz, plan) : 0;

  return {
    png: encodePng(px, W, H),
    cajas,
    informe,
    symbology,
    datosImpresos,
    anchoSimbolo,
    zonaQuieta,
  };
}

/** PNG RGB sin filtro, con la tabla CRC calculada una vez. */
export function encodePng(px: Buffer, W: number, H: number): Buffer {
  const stride = W * 3;
  const raw = Buffer.alloc((stride + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (stride + 1)] = 0;
    px.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });

  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  const crc32 = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, body: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const t = Buffer.from(type, "ascii");
    const cr = Buffer.alloc(4);
    cr.writeUInt32BE(crc32(Buffer.concat([t, body])));
    return Buffer.concat([len, t, body, cr]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}