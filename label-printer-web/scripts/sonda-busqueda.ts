/**
 * Como se comporta la busqueda con 3080 productos en vez de 12.
 *
 * Con 12 productos inventados, teclear "01" devolvia 4-9 coincidencias y el umbral de
 * "muchas coincidencias" nunca se disparo. Con el catalogo real la misma tecnica devuelve
 * cientos, asi que el umbral hay que medirlo, no suponerlo.
 *
 * Ejecutar:  node .preview-build\scripts\sonda-busqueda.js <csv>
 */
import fs from "node:fs";

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
const norm = (s: string) => s.replace(/[\s-]/g, "").toLowerCase();

/** Reproduce la busqueda actual: subcadena sobre el nombre. */
function buscar(q: string): number {
  const n = norm(q);
  return datos.filter((d) => norm(d.nombre).includes(n)).length;
}

console.log("### Cuantas coincidencias da cada tipo de tecleo\n");
const sondas: Array<[string, string]> = [
  ["codigo de barras completo", "7509546074627"],
  ["prefijo de barcode (6)", "750954"],
  ["prefijo de barcode (3)", "750"],
  ["prefijo de barcode (2)", "01"],
  ["prefijo de barcode (1)", "7"],
  ["nombre completo-ish", "LECHE"],
  ["nombre corto", "QUESO"],
  ["nombre corto 2", "GOMITAS"],
  ["palabra generica", "PA"],
  ["palabra muy corta", "A"],
  ["nombre tipico de mostrador", "AMERICANO"],
  ["sin acentos", "CHAMPI"],
  ["con tilde", "CHAMPIÑONES"],
];
for (const [etiqueta, q] of sondas) {
  const n = buscar(q);
  const marca = n === 0 ? "  <- NADA" : n > 200 ? "  <- INMANEJABLE" : n > 50 ? "  <- muchos" : "";
  console.log(`  ${String(n).padStart(5)}  "${q}"  (${etiqueta})${marca}`);
}

console.log("\n### El caso mas importante: escanear un barcode que no existe");
for (const q of ["750954607462", "9999999999999", "XPBOD26080000"]) {
  const n = buscar(q);
  console.log(`  "${q}" por nombre -> ${n} (un escaneo parcial nunca deberia dar esto)`);
}

console.log("\n### Ranking por letra inicial del nombre");
const inicial = new Map<string, number>();
for (const d of datos) {
  const c = norm(d.nombre).charAt(0);
  inicial.set(c, (inicial.get(c) ?? 0) + 1);
}
[...inicial.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  .forEach(([c, n]) => console.log(`  "${c}"  ${n} productos`));
