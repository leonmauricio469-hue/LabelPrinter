/**
 * Los 30 productos de RETAIL/LICORES que NO caben a ^BY3 y SI se escanean.
 *
 * Con la decision tomada ("el 0 delante de los UPC-A vale", "el mostrador se vende por
 * nombre") estos 30 son el ultimo problema real de codificacion. Se listan uno a uno
 * porque cada uno puede tener una salida distinta y no conviene tratarlos igual.
 *
 * Ejecutar:  node .preview-build\scripts\retail-estrecho.js <csv>
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

const retail = datos.filter((d) => d.familia === "RETAIL" || d.familia === "LICORES");

console.log("### Los 30 de RETAIL/LICORES que no caben a ^BY3, uno a uno\n");
const problem = retail
  .filter((d) => {
    const c = d.barcode.replace(/[\s-]/g, "");
    if (isValidEan13(c)) return false;
    if (/^\d{12}$/.test(c) && isValidEan13("0" + c)) return false;
    return encodeCode128Auto(d.barcode).encoded.modules > maxMod(3);
  })
  .map((d) => ({ ...d, modulos: encodeCode128Auto(d.barcode).encoded.modules }))
  .sort((a, b) => b.modulos - a.modulos);

for (const d of problem) {
  const c = d.barcode.replace(/[\s-]/g, "");
  const digitos = /^\d+$/.test(c);
  const largo = c.length;
  const cabe2 = d.modulos <= maxMod(2);
  console.log(`  ${d.barcode.padEnd(18)} ${String(d.modulos).padStart(3)} mod  ${String(largo).padStart(2)} car  ` +
    `${digitos ? "solo digitos" : "alfanumerico"}  ${cabe2 ? "cabe a ^BY2" : "NO cabe ni a ^BY2"}`);
  console.log(`      ${d.familia}  ${d.nombre}  ${d.precio}`);
}

console.log(`\n### Resumen`);
console.log(`  ${problem.length} productos`);
const soloDigitos = problem.filter((d) => /^\d+$/.test(d.barcode.replace(/[\s-]/g, ""))).length;
console.log(`  ${soloDigitos} son solo digitos  ->  Code 128 en subconjunto C, que empaqueta 2 digitos por caracter`);
console.log(`  ${problem.length - soloDigitos} llevan letras  ->  Code 128 en subconjunto B, 1 caracter por posicion`);
console.log(`  ${problem.filter((d) => d.modulos > maxMod(2)).length} no caben ni a ^BY2`);

console.log("\n### Cuantos dots de modulo harian falta para que quepan TODOS a 0,375 mm");
{
  const peor = Math.max(...problem.map((d) => d.modulos));
  // dots disponibles = 400 - 2 zonas; zona = 10 modulos
  // 400 = 2*10*x + peor*x  ->  x = 400 / (20 + peor)
  const x = 400 / (20 + peor);
  console.log(`  el mas ancho tiene ${peor} modulos`);
  console.log(`  con zona quieta de 10X, haria falta un modulo de ${x.toFixed(2)} dots = ${(x / 8).toFixed(3)} mm`);
  console.log(`  el minimo de ISO/IEC 15420 es 0,264 mm, asi que ${(x / 8) < 0.264 ? "NO es legal" : "si es legal"}`);
  console.log(`  sin zona quieta (0X, no conforme): x = ${(400 / peor).toFixed(2)} dots = ${(400 / peor / 8).toFixed(3)} mm`);
}
