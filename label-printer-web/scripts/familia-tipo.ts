/**
 * Cruza FAMILIA con el tipo de codigo, porque la decision de symbologia depende de
 * quien usa cada codigo y no solo de como es.
 *
 * Pregunta: los codigos alfanumericos (XPROD, XPBOD...) son de retail o de mostrador?
 * De eso depende si hace falta Code 128 o si son un caso aparte.
 *
 * Ejecutar:  node .preview-build\scripts\familia-tipo.js <csv>
 */
import fs from "node:fs";
import { isValidEan13 } from "../src/lib/labels/ean13";

const CSV = process.argv[2] ?? ".tmp-catalogo.csv";

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
}));

type Tipo = "ean13" | "upc12" | "alfanumerico" | "sin_codigo";
function tipoDe(b: string): Tipo {
  const c = b.replace(/[\s-]/g, "");
  if (c === "" || /^0+$/.test(c)) return "sin_codigo";
  if (isValidEan13(c)) return "ean13";
  if (/^\d{12}$/.test(c)) return "upc12";
  return "alfanumerico";
}

const porFamilia = new Map<string, Record<Tipo, number>>();
for (const d of datos) {
  const t = tipoDe(d.barcode);
  const r = porFamilia.get(d.familia) ?? { ean13: 0, upc12: 0, alfanumerico: 0, sin_codigo: 0 };
  r[t]++;
  porFamilia.set(d.familia, r);
}

console.log("### Familia x tipo de codigo\n");
console.log("  " + "FAMILIA".padEnd(28) + "total".padStart(6) + "EAN13".padStart(8) + "UPC12".padStart(8) + "ALFA".padStart(8) + "SIN".padStart(6));
console.log("  " + "-".repeat(64));
const orden = [...porFamilia.entries()].sort((a, b) => {
  const ta = a[1].ean13 + a[1].upc12, tb = b[1].ean13 + b[1].upc12;
  return tb - ta;
});
for (const [fam, r] of orden) {
  const total = r.ean13 + r.upc12 + r.alfanumerico + r.sin_codigo;
  console.log("  " + fam.padEnd(28) + String(total).padStart(6) + String(r.ean13).padStart(8) +
    String(r.upc12).padStart(8) + String(r.alfanumerico).padStart(8) + String(r.sin_codigo).padStart(6));
}

const alfanum = datos.filter((d) => tipoDe(d.barcode) === "alfanumerico");
const famAlfa = new Map<string, number>();
alfanum.forEach((d) => famAlfa.set(d.familia, (famAlfa.get(d.familia) ?? 0) + 1));
const soloAlfa = [...famAlfa.entries()].filter(([f]) => {
  const r = porFamilia.get(f)!;
  return r.ean13 === 0 && r.upc12 === 0;
});
console.log(`\n### Las ${alfanum.length} filas con codigo alfanumerico, por familia`);
[...famAlfa.entries()].sort((a, b) => b[1] - a[1]).forEach(([f, n]) => {
  const r = porFamilia.get(f)!;
  const marca = r.ean13 === 0 && r.upc12 === 0 ? "  <-- familia 100% alfanumerica" : "";
  console.log(`  ${String(n).padStart(5)}  ${f}${marca}`);
});
console.log(`\n  familias 100% alfanumericas: ${soloAlfa.length} de ${porFamilia.size}`);
console.log(`  productos en esas familias:   ${soloAlfa.reduce((s, [, n]) => s + n, 0)}`);
console.log("\n  (Si casi todas las alfanumericas estan en familias de mostrador, el Code 128");
console.log("   no es un problema de RETAIL: es un problema de una seccion aparte.)");

const retail = [...porFamilia.entries()].filter(([f]) => f === "RETAIL" || f === "LICORES");
console.log("\n### RETAIL y LICORES, que es lo que se escanea en caja");
for (const [f, r] of retail) {
  const total = r.ean13 + r.upc12 + r.alfanumerico + r.sin_codigo;
  console.log(`  ${f}: ${total} productos -> ${r.ean13} EAN-13, ${r.upc12} UPC-12, ${r.alfanumerico} alfanumericos, ${r.sin_codigo} sin codigo`);
}

console.log("\n### Prefijos de los codigos alfanumericos");
const prefijos = new Map<string, number>();
alfanum.forEach((d) => {
  const p = d.barcode.slice(0, 4);
  prefijos.set(p, (prefijos.get(p) ?? 0) + 1);
});
[...prefijos.entries()].sort((a, b) => b[1] - a[1]).forEach(([p, n]) => console.log(`  ${p}*  ${n}`));
