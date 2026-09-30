// Render the label that buildZpl() produces into a PNG at the printer's own
// resolution, so the geometry can be inspected without spending a label.
//
// This is the tool that answers "why doesn't the scanner read it". It draws the
// real Code 128 module widths, the real ^GFA logo bitmap and a 1 mm grid, and it
// draws the bar pattern in BOTH subsets the printer could pick (Code C = narrowest,
// Code B = widest). If the layout only fits the narrow one, the label depends on the
// printer's subset decision, which is a bug waiting for a different barcode.
//
// Usage (after `tsc -p tsconfig.preview.json`):
//   node .preview-build/scripts/render-label.js [barcode]
//   SCALE=4 node .preview-build/scripts/render-label.js        (px per dot)
//
// Output: preview/label-preview.png
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { buildZpl, symbolDots, quietZoneDots, barcodeZoneOf, planForZone } from "../src/lib/labels/zpl.builder";
import { DEFAULT_TEMPLATE, type BarcodeZone } from "../src/lib/labels/label.template";
import type { LabelData } from "../src/lib/labels/label.types";
import { encodeCode128, encodeCode128Auto } from "../src/lib/labels/code128";
import { EAN13_MODULES } from "../src/lib/labels/ean13";

const SCALE = Number.parseInt(process.env.SCALE ?? "3", 10);
const barcode = process.argv[2] ?? "7591234567801";

const data: LabelData = {
  productName: "CAFE AMANECER DE 500GR",
  barcode,
  price: 7.8,
  reference: "0001",
  businessName: "PA PICAR",
};

const widthDots = DEFAULT_TEMPLATE.widthDots;
const heightDots = DEFAULT_TEMPLATE.heightDots;
const W = widthDots * SCALE;
const H = heightDots * SCALE;

// --------------------------------------------------------------- lienzo RGB blanco
const px = Buffer.alloc(W * H * 3, 0xff);

type Rgb = [number, number, number];
const BLACK: Rgb = [0, 0, 0];
const TEXT: Rgb = [70, 70, 70];
const GRID: Rgb = [228, 228, 228];
const EDGE: Rgb = [255, 55, 55];
const FB: Rgb = [150, 195, 255];
const OKEDGE: Rgb = [0, 150, 0];
const BADEDGE: Rgb = [225, 45, 45];

function rect(xDot: number, yDot: number, wDot: number, hDot: number, c: Rgb) {
  const x0 = xDot * SCALE;
  const y0 = yDot * SCALE;
  const w = wDot * SCALE;
  const h = hDot * SCALE;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = (y * W + x) * 3;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
    }
  }
}

function vLine(xDot: number, y0: number, y1: number, c: Rgb) {
  rect(xDot, y0, 1, Math.max(1, y1 - y0), c);
}

function hLine(x0: number, x1: number, yDot: number, c: Rgb) {
  rect(x0, yDot, Math.max(1, x1 - x0), 1, c);
}

// ------------------------------------------------------------- fuente 3x5 compacta
// Cada glifo son 5 digitos, uno por fila. Cada digito codifica 3 pixeles: bit 4 =
// izquierda, bit 2 = centro, bit 1 = derecha.
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

/** Dibuja `text` occupying `hDot` of height starting at (xDot, yDot). Returns dots used. */
function drawText(xDot: number, yDot: number, hDot: number, wDot: number, text: string, c: Rgb): number {
  const sx = Math.max(1, Math.round(wDot / 4));
  const sy = Math.max(1, Math.round(hDot / 5));
  const advance = sx * 4;
  let cx = xDot;
  for (const ch of text) {
    const glyph = FONT[ch.toUpperCase()] ?? FONT["?"];
    for (let ry = 0; ry < 5; ry++) {
      const bits = glyph.charCodeAt(ry) - 48;
      for (let rx = 0; rx < 3; rx++) {
        if (bits & (4 >> rx)) rect(cx + rx * sx, yDot + ry * sy, sx, sy, c);
      }
    }
    cx += advance;
  }
  return cx - xDot;
}

// --------------------------------------------------------------- dibujo del ^GFA
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

// ------------------------------------------------------- dibujo del ^BC (Code 128)
function drawBarcode(text: string, xDot: number, yDot: number, hDot: number, moduleW: number, subset: "C" | "B") {
  const enc = encodeCode128(text, subset);
  const total = enc.modules * moduleW;
  let cx = xDot;
  let bar = true;
  for (const w of enc.widths) {
    if (bar) rect(cx, yDot, w * moduleW, hDot, BLACK);
    cx += w * moduleW;
    bar = !bar;
  }

  const right = xDot + total;
  const quietLeft = xDot;
  const quietRight = widthDots - right;

  // Debajo de las barras va la linea de interpretacion humana (^BC ... ,Y).
  drawText(xDot, yDot + hDot + 2, 12, 7, text, TEXT);

  const ok = right <= widthDots && quietLeft >= 10 * moduleW && quietRight >= 10 * moduleW;
  vLine(right, yDot, yDot + hDot, ok ? OKEDGE : BADEDGE);
  console.log(
    `  ${subset}: ${enc.modules} mod x ${moduleW} = ${total} dots (${(total / 8).toFixed(1)} mm)` +
      `  x ${xDot}..${right}  quieta ${quietLeft}/${quietRight} dots` +
      ` (${(quietLeft / 8).toFixed(2)}/${(quietRight / 8).toFixed(2)} mm)  ${ok ? "OK" : "FALLA"}`,
  );
  return { total, right, ok };
}

/** Como lo decide de verdad la impresora: subconjunto automatico de ZPL. */
function drawAutoBarcode(text: string, xDot: number, yDot: number, hDot: number, moduleW: number) {
  const { encoded, note } = encodeCode128Auto(text);
  const total = encoded.modules * moduleW;
  let cx = xDot;
  let bar = true;
  for (const w of encoded.widths) {
    if (bar) rect(cx, yDot, w * moduleW, hDot, BLACK);
    cx += w * moduleW;
    bar = !bar;
  }
  drawText(xDot, yDot + hDot + 2, 12, 7, text, TEXT);

  const right = xDot + total;
  const ok = right <= widthDots && xDot >= 10 * moduleW && widthDots - right >= 10 * moduleW;
  vLine(right, yDot, yDot + hDot, ok ? OKEDGE : BADEDGE);
  console.log(
    `  automatico (${note}): ${encoded.modules} mod x ${moduleW} = ${total} dots (${(total / 8).toFixed(1)} mm)  x ${xDot}..${right}  ${ok ? "OK" : "FALLA"}`,
  );
  return { total, right, ok };
}

/** EAN-13 son exactamente 95 modulos: el ancho no depende de ningun subconjunto. */
function drawEan13(text: string, xDot: number, yDot: number, hDot: number, moduleW: number) {
  const total = EAN13_MODULES * moduleW;
  // Esquema real de guardas y patron de paridad, para que se vea "barras y espacios"
  // con el contraste correcto. El patron exacto lo pone la impresora.
  for (let m = 0; m < EAN13_MODULES; m++) {
    const inGuard = m < 3 || (m >= 45 && m < 50) || m >= 92;
    const on = inGuard ? m % 2 === 0 : (m * 7 + 3) % 3 !== 0;
    if (on) rect(xDot + m * moduleW, yDot, moduleW, hDot, BLACK);
  }
  drawText(xDot, yDot + hDot + 2, 12, 7, text, TEXT);
  const right = xDot + total;
  const ok = right <= widthDots && xDot >= 10 * moduleW && widthDots - right >= 10 * moduleW;
  vLine(right, yDot, yDot + hDot, ok ? OKEDGE : BADEDGE);
  console.log(
    `  EAN-13: ${EAN13_MODULES} mod x ${moduleW} = ${total} dots (${(total / 8).toFixed(1)} mm)` +
      `  x ${xDot}..${right}  quieta ${xDot}/${widthDots - right} dots` +
      ` (${(xDot / 8).toFixed(2)}/${((widthDots - right) / 8).toFixed(2)} mm, min 10X = ${(10 * moduleW / 8).toFixed(2)} mm)  ${ok ? "OK" : "FALLA"}`,
  );
  return { total, right, ok };
}


// --------------------------------------------------------------------------- main
console.log(`Etiqueta ${widthDots} x ${heightDots} dots = ${widthDots / 8} x ${heightDots / 8} mm @ 203 dpi`);
console.log(`Barcode "${barcode}"\n`);

for (let d = 0; d <= widthDots; d += 8) vLine(d, 0, H, GRID);
for (let d = 0; d <= heightDots; d += 8) hLine(0, W, d, GRID);
vLine(widthDots - 1, 0, H, EDGE);
hLine(0, W, heightDots - 1, EDGE);

const zpl = buildZpl(DEFAULT_TEMPLATE, data);

// El ^GFA lleva saltos de linea internos: se saca del ZPL completo antes de trocear.
const gfMatch = zpl.match(/\^GFA,[\s\S]*?\n\^FS/);
if (gfMatch) drawGraphic(gfMatch[0], Math.round((widthDots - 200) / 2), 2);

let curX = 0;
let curY = 0;
let fontH = 0;
let fontW = 0;
let byW = 2;
let bcH = 0;
let symbology: "ean13" | "code128" = "code128";
let inBarcode = false;
const zones: string[] = [];

for (const raw of zpl.split("\n")) {
  const line = raw.trim();
  if (line === "" || line.startsWith("^XA") || line.startsWith("^XZ")) continue;
  if (line.startsWith("^PW") || line.startsWith("^LL") || line.startsWith("^LH")) continue;
  if (line.startsWith("^GFA")) continue; // ya dibujado

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
    // ^BC o,h,...  ^BE o,h,...
    bcH = Number.parseInt(line.slice(3).split(",")[1], 10);
    symbology = line.startsWith("^BE") ? "ean13" : "code128";
    inBarcode = true;
    continue;
  }
  if (line.startsWith("^FD")) {
    const text = line.slice(3).replace(/\^FS$/, "");
    if (inBarcode) {
      const xmm = (byW / 8).toFixed(3);
      const hmm = (bcH / 8).toFixed(2);
      console.log("Como queda AHORA:");
      console.log(`  ${symbology.toUpperCase()}  ^BY ancho de modulo ${byW} dots = ${xmm} mm  (minimo ISO 15420: 0.264 mm)`);
      console.log(`  ^BC alto ${bcH} dots = ${hmm} mm  (minimo practico 6.64 mm)`);
      if (symbology === "ean13") {
        drawEan13(text, curX, curY, bcH, byW);
      } else {
        drawAutoBarcode(text, curX, curY, bcH, byW);
        drawBarcode(text, curX, curY, 4, byW, "B");
      }
      inBarcode = false;
      continue;
    }
    const used = drawText(curX, curY, fontH, fontW, text, TEXT);
    zones.push(
      `  "${text}"  alto ${fontH}  ancho ${used}  x ${curX}..${curX + used}  y ${curY}..${curY + fontH}` +
        (curX + used > widthDots ? "   <-- SE PASA POR LA DERECHA" : "") +
        (curY + fontH > heightDots ? "   <-- SE PASA POR ABAJO" : ""),
    );
    continue;
  }
}

console.log("Textos:");
for (const z of zones) console.log(z);

// ---------------------------------------------------------------------- analisis
// Que combinaciones caben en 400 dots con zona quieta minima de 10X a cada lado.
console.log("\nCandidatos (400 dots = 50 mm de ancho, zona quieta minima 10X):");
console.log("  simbologia       ^BY   X(mm)   ancho simbolo          quieta izq/der   verdict");
type Row = { label: string; modules: number; by: number };
const auto = encodeCode128Auto(barcode).encoded.modules;
const candidates: Row[] = [
  { label: "Code 128 (viejo)", modules: auto, by: 2 },
  { label: "Code 128        ", modules: auto, by: 3 },
  { label: "Code 128        ", modules: auto, by: 4 },
  { label: "EAN-13          ", modules: EAN13_MODULES, by: 2 },
  { label: "EAN-13          ", modules: EAN13_MODULES, by: 3 },
  { label: "EAN-13          ", modules: EAN13_MODULES, by: 4 },
];
for (const c of candidates) {
  const bars = c.modules * c.by;
  const x = Math.max(0, Math.round((widthDots - bars) / 2));
  const quietR = widthDots - x - bars;
  const ok = bars + 2 * 10 * c.by <= widthDots && x >= 10 * c.by && quietR >= 10 * c.by;
  console.log(
    `  ${c.label}   ${c.by}   ${(c.by / 8).toFixed(3)}   ${String(bars).padStart(4)} dots (${(bars / 8).toFixed(1)} mm)   ` +
      `${String(x).padStart(3)}/${String(quietR).padEnd(3)} dots      ${ok ? "OK" : "NO CABE"}`,
  );
}

console.log(`\n  Alto disponible: ${heightDots} dots (${heightDots / 8} mm)`);
for (const h of [48, 64, 72, 80, 88]) {
  console.log(
    `    barras de ${String(h).padStart(2)} dots (${(h / 8).toFixed(1)} mm) deja ${heightDots - h} dots (${((heightDots - h) / 8).toFixed(1)} mm) para logo + textos + HRI`,
  );
}

// El builder es quien centra, asi que se comprueba con el, no a ojo.
const zone = barcodeZoneOf(DEFAULT_TEMPLATE) as BarcodeZone;
const plan = planForZone(DEFAULT_TEMPLATE, zone, barcode);
console.log("\nComprobacion con el builder:");
if (plan.printable) {
  console.log(`  symbologia   ${plan.symbology}  (la decide planBarcode(), no la plantilla)`);
  console.log(`  datos        ${plan.data}${plan.correctedFrom ? `  (corregido desde ${plan.correctedFrom})` : ""}`);
  console.log(`  simbolo      ${plan.modules} modulos`);
  console.log(`  ancho        ${symbolDots(zone, plan)} dots (${(symbolDots(zone, plan) / 8).toFixed(1)} mm)`);
  console.log(`  zona quieta  ${quietZoneDots(DEFAULT_TEMPLATE, zone, plan)} dots (min ${10 * zone.moduleWidth})`);
} else {
  console.log(`  SIN CODIGO   ${plan.reason}: ${plan.detail}`);
  console.log(`  La etiqueta sale con zonesWithoutBarcode.`);
}


// ------------------------------------------------------------------ escritura PNG
function writePng(path: string) {
  const stride = W * 3;
  const raw = Buffer.alloc((stride + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (stride + 1)] = 0; // filtro None
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
  ihdr[8] = 8; // profundidad
  ihdr[9] = 2; // RGB

  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", idat),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

mkdirSync("preview", { recursive: true });
writePng("preview/label-preview.png");
console.log("\n  -> preview/label-preview.png");
