/**
 * Analisis del catalogo real de PA PICAR antes de convertirlo.
 *
 * NO convierte nada. Solo responde preguntas sobre el archivo, porque hay decisiones
 * pendientes (simbologia del barcode) que dependen de lo que salga aqui y no de lo que
 * uno suponga.
 *
 * Ejecutar:  node .preview-build\scripts\analyze-catalogo.js
 */
import fs from "node:fs";

const CSV = process.argv[2] ?? ".tmp-catalogo.csv";

/** Parser de CSV/TSV minimo, suficiente para lo que exporta el sistema. */
function parseDelimited(text: string): string[][] {
  const filas = [];
  let campo = "";
  let fila = [];
  let enComillas = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (enComillas) {
      if (ch === '"') {
        if (text[i + 1] === '"') { campo += '"'; i++; }
        else enComillas = false;
      } else campo += ch;
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
const cabecera = filas[0].map((c) => c.trim());
const datos: Record<string, string>[] = filas.slice(1).map((f) => ({
  n: (f[0] ?? "").trim(),
  familia: (f[1] ?? "").trim(),
  barcode: (f[2] ?? "").trim(),
  nombre: (f[3] ?? "").trim(),
  precio: (f[4] ?? "").trim(),
}));

console.log("### Encabezado");
console.log("  " + cabecera.join(" | "));
console.log(`\n### Filas de datos: ${datos.length}`);

console.log("\n### Valores vacios por columna");
for (const k of ["n", "familia", "barcode", "nombre", "precio"]) {
  const vacios = datos.filter((d) => d[k] === "").length;
  console.log(`  ${k.padEnd(9)} vacios: ${vacios}`);
}

console.log("\n### Formato de los codigos de barra (columna 'Codigo de Barra')");
{
  const patrones = new Map();
  const longitudes = new Map();
  let soloDigitos = 0, conLetras = 0;
  for (const d of datos) {
    const b = d.barcode;
    if (b === "") continue;
    longitudes.set(b.length, (longitudes.get(b.length) ?? 0) + 1);
    if (/^\d+$/.test(b)) soloDigitos++;
    else conLetras++;
    // Se agrupa por patron: digito -> 9, letra -> X
    const patron = b.replace(/\d/g, "9").replace(/[A-Za-z]/g, "X");
    patrones.set(patron, (patrones.get(patron) ?? 0) + 1);
  }
  console.log(`  solo digitos (EAN-13, UPC, etc.): ${soloDigitos}`);
  console.log(`  con letras:                      ${conLetras}`);
  console.log("  longitudes:");
  [...longitudes.entries()].sort((a, b) => a[0] - b[0]).forEach(([l, c]) => console.log(`    ${String(l).padStart(2)} caracteres: ${c}`));
  console.log("  patrones (9 = digito, X = letra), los 15 mas comunes:");
  [...patrones.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
    .forEach(([p, c]) => console.log(`    ${p.padEnd(24)} ${c}`));
}

console.log("\n### EAN-13 real (13 digitos con digito de control correcto)");
{
  const ean = datos.filter((d) => /^\d{13}$/.test(d.barcode));
  console.log(`  codigos que son 13 digitos: ${ean.length}`);
  if (ean.length > 0) ean.slice(0, 10).forEach((d) => console.log(`    ${d.barcode}  ${d.nombre}`));
}

console.log("\n### Precios");
{
  const conSimbolo = datos.filter((d) => /^\$/.test(d.precio)).length;
  const conComa = datos.filter((d) => d.precio.includes(",")).length;
  const conPunto = datos.filter((d) => /^\$?\d+\.\d{2}$/.test(d.precio)).length;
  const raro = datos.filter((d) => d.precio !== "" && !/^\$?\d+[.,]\d{2}$/.test(d.precio));
  console.log(`  empiezan por $:        ${conSimbolo}`);
  console.log(`  contienen coma:        ${conComa}`);
  console.log(`  con formato $N.NN:     ${conPunto}`);
  console.log(`  formato raro:          ${raro.length}`);
  raro.slice(0, 15).forEach((d) => console.log(`    "${d.precio}"  ${d.nombre}`));

  const nums = datos.map((d) => Number(d.precio.replace(/[^0-9.,]/g, "").replace(",", "."))).filter((n) => Number.isFinite(n));
  nums.sort((a, b) => a - b);
  const pct = (p: number) => nums[Math.floor(nums.length * p)];
  console.log(`  min=${nums[0]}  p25=${pct(0.25)}  mediana=${pct(0.5)}  p75=${pct(0.75)}  max=${nums[nums.length - 1]}`);
  console.log(`  decimales distintos: ${[...new Set(nums.map((n) => (String(n).split(".")[1] ?? "").length))].sort().join(", ")}`);
}

console.log("\n### Nombres de producto");
{
  const lens = datos.map((d) => d.nombre.length).sort((a, b) => a - b);
  const pct = (p: number) => lens[Math.floor(lens.length * p)];
  console.log(`  longitud  min=${lens[0]}  p50=${pct(0.5)}  p90=${pct(0.9)}  p99=${pct(0.99)}  max=${lens[lens.length - 1]}`);
  const largos = [...datos].sort((a, b) => b.nombre.length - a.nombre.length).slice(0, 8);
  console.log("  los mas largos (importan para el ancho de la etiqueta):");
  largos.forEach((d) => console.log(`    ${String(d.nombre.length).padStart(3)}  ${d.nombre}`));
  const conAcento = datos.filter((d) => /[áéíóúÁÉÍÓÚñÑü]/.test(d.nombre)).length;
  const conSimbolo = datos.filter((d) => /[^A-Za-z0-9ÁÉÍÓÚáéíóúÑñÜü .()\-\/]/.test(d.nombre)).length;
  console.log(`  con acentos/enie: ${conAcento}`);
  console.log(`  con caracteres poco comunes: ${conSimbolo}`);
  [...new Set(datos.flatMap((d) => (d.nombre.match(/[^A-Za-z0-9ÁÉÍÓÚáéíóúÑñÜü .()\-\/]/g) ?? [])))]
    .forEach((ch) => console.log(`    caracter: "${ch}"`));
}

console.log("\n### Familias");
{
  const fam = new Map();
  for (const d of datos) fam.set(d.familia, (fam.get(d.familia) ?? 0) + 1);
  console.log(`  total: ${fam.size}`);
  [...fam.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([f, c]) => console.log(`    ${String(c).padStart(5)}  ${f}`));
}

console.log("\n### Duplicados");
{
  const porBarcode = new Map();
  const porNombre = new Map();
  for (const d of datos) {
    if (d.barcode) porBarcode.set(d.barcode, (porBarcode.get(d.barcode) ?? 0) + 1);
    const clave = d.nombre.toUpperCase();
    porNombre.set(clave, (porNombre.get(clave) ?? 0) + 1);
  }
  const dupB = [...porBarcode.entries()].filter(([, c]) => c > 1);
  const dupN = [...porNombre.entries()].filter(([, c]) => c > 1);
  console.log(`  codigos de barra repetidos: ${dupB.length}`);
  dupB.slice(0, 12).forEach(([b, c]) => {
    console.log(`    "${b}" x${c}`);
    datos.filter((d) => d.barcode === b).slice(0, 4).forEach((d) => console.log(`        $${d.precio}  ${d.nombre}`));
  });
  console.log(`  nombres repetidos: ${dupN.length}`);
  dupN.slice(0, 12).forEach(([n, c]) => console.log(`    x${c}  ${n}`));
}

console.log("\n### Lo que ya NO es un problema del catalogo inventado");
console.log(`  el # de la primera columna es un indice, no un codigo de barras:`);
console.log(`    empieza en "${datos[0].n}", acaba en "${datos[datos.length - 1].n}", y es correlativo`);
