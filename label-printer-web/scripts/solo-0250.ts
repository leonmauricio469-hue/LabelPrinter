/**
 * De los productos que SOLO caben a 0,250 mm, cuantos son de RETAIL/LICORES (se escanean)
 * y cuantos son de mostrador (no se escanean).
 *
 * Importa porque la respuesta "esos 30 sin codigo" se tomo por no bajar a 0,250 mm, que
 * esta un 5% por debajo del minimo de ISO/IEC 15420. Ese mismo motivo alcanza a los 182
 * que solo caben a 0,250 mm. Hay que saber si son muchos de caja o muchos de mostrador.
 *
 * Ejecutar:  node .preview-build\scripts\solo-0250.js <csv>
 */
import fs from "node:fs";
import { encodeCode128Auto } from "../src/lib/labels/code128";
import { isValidEan13 } from "../src/lib/labels/ean13";

const CSV = process.argv[2] ?? ".tmp-catalogo.csv";
const DOTS = 400;
const QUIET = 10;
const maxMod = (x: number) => Math.floor((DOTS - 2 * QUIET * x) / x);

function parseDelimited(text: string): string[][] {
  const filas: string[][] = [];
  let campo = "";
  let fila: string[] = [];
  let enComillas = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (enComillas) {
      if (ch === '"') { if (text[i + 1] === '"') { campo += '"'; i++; } else enComillas = false; }
      else campo += ch;
      continue;
    }
    if (ch === '"') { enComillas = true; continue; }
    if (ch === ";") { fila.push(campo); campo = ""; continue; }
    if (ch === "\r") continue;
    if (ch === "\n") { fila.push(campo); filas.push(fila); fila = []; campo = ""; continue; }
    campo += ch;
  }
  if (campo.length > 0 || fila.length > 0) { fila.push(campo); filas.push(fila); }
  return filas;
}

const filas = parseDelimited(fs.readFileSync(CSV, "utf8")).filter((f) => f.some((c) => c.trim() !== ""));
const datos = filas.slice(1).map((f) => ({
  familia: (f[1] ?? "").trim(),
  barcode: (f[2] ?? "").trim(),
  nombre: (f[3] ?? "").trim(),
  precio: (f[4] ?? "").trim(),
}));

const esMostrador = (f: string) => f !== "RETAIL" && f !== "LICORES";

/** Un producto va con ^BE si su codigo es un EAN-13 de verdad, o un UPC-A con el 0 delante. */
const control = (c: string) => {
  if (isValidEan13(c)) return c;
  if (/^\d{12}$/.test(c) && isValidEan13("0" + c)) return "0" + c;
  return null;
};

const conBarcode = datos
  .map((d) => ({ ...d, compacto: d.barcode.replace(/[\s-]/g, "") }))
  .filter((d) => d.compacto !== "" && !/^0+$/.test(d.compacto));

const resolubles = conBarcode.map((d) => {
  const ean = control(d.compacto);
  if (ean) return { ...d, via: "ean13" as const, modulos: 95, impreso: ean };
  return { ...d, via: "code128" as const, modulos: encodeCode128Auto(d.barcode).encoded.modules, impreso: d.barcode };
});

const porVia = { ean13: 0, code128: 0 };
const porViaRetail = { ean13: 0, code128: 0 };
for (const d of resolubles) {
  porVia[d.via]++;
  if (!esMostrador(d.familia)) porViaRetail[d.via]++;
}

console.log("### Reparto de los 3080 productos\n");
console.log(`  con ^BE (EAN-13 tal cual o UPC-A con 0 delante):   ${porVia.ean13}`);
console.log(`  con ^BC (Code 128):                              ${porVia.code128}`);
console.log("");
console.log("### De los que van con Code 128, segun el ancho de modulo\n");

const c128 = resolubles.filter((d) => d.via === "code128");
const filasTabla: Array<[string, (d: typeof c128[number]) => boolean]> = [
  ["cabe a 0,375 mm (^BY3)", (d) => d.modulos <= maxMod(3)],
  ["solo cabe a 0,250 mm (^BY2)", (d) => d.modulos > maxMod(3) && d.modulos <= maxMod(2)],
  ["no cabe ni a 0,250 mm", (d) => d.modulos > maxMod(2)],
];
for (const [etiqueta, test] of filasTabla) {
  const sel = c128.filter(test);
  const retail = sel.filter((d) => !esMostrador(d.familia));
  console.log(`  ${etiqueta}`);
  console.log(`      total ${String(sel.length).padStart(4)}   de los cuales RETAIL/LICORES ${String(retail.length).padStart(4)}   mostrador ${String(sel.length - retail.length).padStart(4)}`);
}

console.log("\n### Si NO se usa 0,250 mm: cuantos productos se quedan SIN codigo de barras");
const sinCodigo = c128.filter((d) => d.modulos > maxMod(3));
const sinRetail = sinCodigo.filter((d) => !esMostrador(d.familia));
const sinMostrador = sinCodigo.filter((d) => esMostrador(d.familia));
const sinCodigoTotal = sinCodigo.length + datos.filter((d) => /^0*$/.test(d.barcode.replace(/[\s-]/g, ""))).length + datos.filter((d) => d.barcode.trim().toLowerCase() === "null").length;
console.log(`  products que necesitan Code 128 pero no caben a 0,375 mm: ${sinCodigo.length}`);
console.log(`      RETAIL/LICORES (se escanean en caja): ${sinRetail.length}`);
console.log(`      mostrador (se venden por nombre):     ${sinMostrador.length}`);
console.log(`  mas los que no tienen codigo ("0" y "null"): ${datos.filter((d) => /^0*$/.test(d.barcode.replace(/[\s-]/g, ""))).length + datos.filter((d) => d.barcode.trim().toLowerCase() === "null").length}`);
console.log(`  TOTAL de productos que saldrian sin codigo: ${sinCodigoTotal} de ${datos.length} (${((sinCodigoTotal / datos.length) * 100).toFixed(1)}%)`);

console.log("\n### Los de RETAIL/LICORES que se quedarian sin codigo, de una linea cada uno");
for (const d of sinRetail.sort((a, b) => b.modulos - a.modulos)) {
  console.log(`  ${String(d.modulos).padStart(3)} mod  ${d.barcode.padEnd(18)} ${d.nombre}`);
}

console.log("\n### Y los de mostrador, solo el reparto por familia (son los que se venden por nombre)");
const fam = new Map<string, number>();
sinMostrador.forEach((d) => fam.set(d.familia, (fam.get(d.familia) ?? 0) + 1));
[...fam.entries()].sort((a, b) => b[1] - a[1]).forEach(([f, n]) => console.log(`  ${String(n).padStart(4)}  ${f}`));
