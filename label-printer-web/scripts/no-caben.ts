/**
 * Los 84 codigos que NO caben ni a ^BY2 en 50 mm: de que familias son.
 *
 * Es la pregunta que separa "problema de todo el catalogo" de "problema de una seccion".
 *
 * Ejecutar:  node .preview-build\scripts\no-caben.js <csv>
 */
import fs from "node:fs";
import { encodeCode128Auto } from "../src/lib/labels/code128";
import { isValidEan13 } from "../src/lib/labels/ean13";

const CSV = process.argv[2] ?? ".tmp-catalogo.csv";
const DOTS = 400;
const QUIET = 10;

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

const maxMod = (x: number) => Math.floor((DOTS - 2 * QUIET * x) / x);
const c128 = datos
  .filter((d) => {
    const c = d.barcode.replace(/[\s-]/g, "");
    return c !== "" && !/^0+$/.test(c) && !isValidEan13(c) && !/^\d{12}$/.test(c);
  })
  .map((d) => ({ ...d, modulos: encodeCode128Auto(d.barcode).encoded.modules }));

console.log(`### De los ${c128.length} codigos que necesitan Code 128\n`);
for (const x of [3, 2]) {
  const no = c128.filter((d) => d.modulos > maxMod(x));
  const fam = new Map<string, number>();
  no.forEach((d) => fam.set(d.familia, (fam.get(d.familia) ?? 0) + 1));
  const retail = no.filter((d) => d.familia === "RETAIL" || d.familia === "LICORES").length;
  console.log(`  ^BY${x} (max ${maxMod(x)} modulos): NO caben ${no.length}, de los cuales ${retail} son de RETAIL/LICORES`);
  [...fam.entries()].sort((a, b) => b[1] - a[1]).forEach(([f, n]) => console.log(`      ${String(n).padStart(3)}  ${f}`));
  console.log("");
}

console.log("### Ancho de etiqueta que necesitarian los que no caben a ^BY2");
const no2 = c128.filter((d) => d.modulos > maxMod(2));
// mm = (modulos + 2 zonas de 10 modulos) * dots_por_modulo / 8 dots_por_mm
const anchos = [...new Set(no2.map((d) => Math.round(((d.modulos + 2 * QUIET) * 3) / 8)))]
  .sort((a, b) => a - b);
console.log(`  a ^BY3 (0,375 mm/modulo) y con 10X de zona quieta, el mas ancho pide:`);
anchos.slice(0, 4).forEach((mm) => console.log(`    ${mm.toFixed(1).replace(".", ",")} mm`));
console.log("  (la etiqueta actual son 50,0 mm)");
console.log("\n### RETAIL/LICORES: cobertura con EAN-13 + 0 delante de los UPC-A");
{
  const retail = datos.filter((d) => d.familia === "RETAIL" || d.familia === "LICORES");
  const comoEan = retail.filter((d) => {
    const c = d.barcode.replace(/[\s-]/g, "");
    return isValidEan13(c) || (isValidEan13("0" + c) && /^\d{12}$/.test(c));
  }).length;
  console.log(`  ${comoEan} de ${retail.length} (${((comoEan / retail.length) * 100).toFixed(1)}%) se imprimen con ^BE sin tocar el codigo`);
  const necesitan = retail.length - comoEan;
  console.log(`  ${necesitan} necesitan Code 128`);
  const caben3 = retail.filter((d) => {
    const c = d.barcode.replace(/[\s-]/g, "");
    if (isValidEan13(c) || (isValidEan13("0" + c) && /^\d{12}$/.test(c))) return false;
    return encodeCode128Auto(d.barcode).encoded.modules <= maxMod(3);
  }).length;
  console.log(`  de esas ${necesitan}, ${caben3} caben a ^BY3 y ${necesitan - caben3} no`);
}
