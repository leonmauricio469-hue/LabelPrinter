/**
 * Cuantos de los codigos que NO son EAN-13 caben de verdad en una etiqueta de 50 mm.
 *
 * Usa `encodeCode128Auto` del propio proyecto, no una estimacion. Ya se sabe por que: una
 * estimacion anterior fallo por 11 modulos y eso fue un barcode ilegible.
 *
 * Ejecutar:  node .preview-build\scripts\mide-codigos.js <csv>
 */
import fs from "node:fs";
import { encodeCode128Auto } from "../src/lib/labels/code128";
import { isValidEan13 } from "../src/lib/labels/ean13";

const CSV = process.argv[2] ?? ".tmp-catalogo.csv";

/** 50 mm a 203 dpi = 8 dots/mm. */
const DOTS = 50 * 8;
/** Zona quieta minima de Code 128: 10 X a cada lado. */
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
  barcode: (f[2] ?? "").trim(),
  nombre: (f[3] ?? "").trim(),
  familia: (f[1] ?? "").trim(),
}));

console.log(`### Geometria de la etiqueta`);
console.log(`  ancho: ${DOTS} dots (50 mm a 8 dots/mm)`);
console.log(`  zona quieta 10X a cada lado:`);
for (const x of [2, 3]) {
  const zona = QUIET * x;
  const disponible = DOTS - 2 * zona;
  console.log(`    ^BY${x} (${x} dots/modulo = ${(x / 8).toFixed(3)} mm): zona ${zona} dots, ` +
    `quedan ${disponible} dots = ${Math.floor(disponible / x)} modulos`);
}

// Cuantos caben como EAN-13
const ean = datos.filter((d) => isValidEan13(d.barcode.replace(/[\s-]/g, "")));
console.log(`\n### EAN-13: ${ean.length} productos, 95 modulos fijos, caben todos`);

// El resto necesita Code 128
const otros = datos.filter((d) => {
  const c = d.barcode.replace(/[\s-]/g, "");
  return c !== "" && !/^0+$/.test(c) && !isValidEan13(c);
});

const medidas = otros.map((d) => {
  const { encoded, note } = encodeCode128Auto(d.barcode);
  return { ...d, modulos: encoded.modules, subconjunto: note };
}).sort((a, b) => b.modulos - a.modulos);

console.log(`\n### Code 128: ${medidas.length} productos, medidos con el codificador real`);
const mods = medidas.map((m) => m.modulos).sort((a, b) => a - b);
const pct = (p: number) => mods[Math.floor(mods.length * p)];
console.log(`  modulos  min=${mods[0]}  p50=${pct(0.5)}  p90=${pct(0.9)}  p99=${pct(0.99)}  max=${mods[mods.length - 1]}`);

console.log("\n### Cuantos caben segun el ancho de modulo");
for (const x of [2, 3]) {
  const maxMod = Math.floor((DOTS - 2 * QUIET * x) / x);
  const caben = medidas.filter((m) => m.modulos <= maxMod).length;
  const noCaben = medidas.length - caben;
  console.log(`  ^BY${x} (${(x / 8).toFixed(3)} mm/modulo, max ${maxMod} modulos):`);
  console.log(`    caben ${caben}   NO caben ${noCaben}` + (noCaben > 0 ? "" : "   <- todos"));
}

console.log("\n### Los que NO caben a ^BY3 (el modulo que se usa hoy)");
const noCaben3 = medidas.filter((m) => m.modulos > Math.floor((DOTS - 2 * QUIET * 3) / 3));
console.log(`  ${noCaben3.length} productos`);
noCaben3.slice(0, 15).forEach((m) => {
  console.log(`    ${String(m.modulos).padStart(3)} mod  ${m.barcode.padEnd(20)} ${m.nombre}`);
});
if (noCaben3.length > 15) console.log(`    ... y ${noCaben3.length - 15} mas`);

console.log("\n### Los 5 mas anchos, y de que familia son");
medidas.slice(0, 5).forEach((m) => {
  console.log(`    ${String(m.modulos).padStart(3)} mod  ${m.barcode.padEnd(20)} [${m.familia}]  ${m.nombre}`);
});

const upc = otros.filter((d) => /^\d{12}$/.test(d.barcode.replace(/[\s-]/g, "")));

console.log("\n### Codigos de 12 digitos: NO son EAN-13, pero si se pueden imprimir como EAN-13 con un 0 delante");
{
  const ok = upc.filter((d) => isValidEan13("0" + d.barcode.replace(/[\s-]/g, "")));
  console.log(`  ${ok.length} de ${upc.length} pasan la prueba del digito de control con el 0 delante`);
  console.log(`  ejemplo: ${upc[0]?.barcode} -> 0${upc[0]?.barcode} (EAN-13 de 95 modulos, sigue cabiendo)`);
  const malos = upc.filter((d) => !isValidEan13("0" + d.barcode.replace(/[\s-]/g, "")));
  console.log(`  los ${malos.length} que no pasan:`);
  malos.forEach((d) => console.log(`    ${d.barcode}  ${d.nombre}`));
}

console.log("\n### Resumen para los 3080 productos");
const code128Necesario = otros.filter((d) => !/^\d{12}$/.test(d.barcode.replace(/[\s-]/g, "")));
const code128Cabe3 = code128Necesario.filter((d) => {
  const { encoded } = encodeCode128Auto(d.barcode);
  return encoded.modules <= Math.floor((DOTS - 2 * QUIET * 3) / 3);
});
console.log(`  EAN-13 tal cual:                       ${ean.length}`);
console.log(`  UPC-A con 0 delante:                   ${upc.length}`);
console.log(`  Code 128 que SI cabe a ^BY3:           ${code128Cabe3.length}`);
console.log(`  Code 128 que NO cabe a ^BY3:           ${code128Necesario.length - code128Cabe3.length}`);
console.log(`  Sin codigo imprimible (barcode "0"):   ${datos.filter((d) => /^0*$/.test(d.barcode.replace(/[\s-]/g, ""))).length}`);
