/**
 * Convierte el CSV del export de PA PICAR en `data/catalog.json`.
 *
 * NO decide nada de codigos ni de symbologias: eso vive en `src/lib/labels/barcode-plan.ts`.
 * Aqui solo se traduce una tabla a otra y se escribe un informe de lo que se ha encontrado
 * raro. Un importador que arregla datos en silencio es un importador que miente.
 *
 * Ejecutar:  node .preview-build\scripts\importar-catalogo.js <csv> [--escribir]
 */
import fs from "node:fs";
import path from "node:path";
import { productSchema } from "../src/lib/validation/schemas";
import type { ProductInput } from "../src/lib/validation/schemas";
import { ean13CheckDigit, isValidEan13 } from "../src/lib/labels/ean13";

const CSV = process.argv[2] ?? ".tmp-catalogo.csv";
const ESCRIBIR = process.argv.includes("--escribir");
const SALIDA = "data/catalog.json";
const INFORME = "data/informe-catalogo.md";

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

/**
 * El export viene como texto con signo y dos decimales ("$2.30"). Se aceptan las tres
 * formas que aparecen en la vida real: `2.30`, `2,30` y `1.234,56`. Devolver `null` si no
 * hay un numero dentro, para no convertir "N/A" en 0 y poner una etiqueta con precio cero.
 */
function precioDesde(valor: string): number | null {
  const s = valor.replace(/[$\s\u00a0]/g, "");
  if (s === "") return null;
  let normalizado = s;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    normalizado = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+,\d+$/.test(s)) {
    normalizado = s.replace(",", ".");
  } else {
    normalizado = s.replace(/,/g, "");
  }
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

const texto = fs.readFileSync(CSV, "utf8").replace(/^\uFEFF/, "");
const filas = parseDelimited(texto).filter((f) => f.some((c) => c.trim() !== ""));
const cabecera = filas[0].map((c) => c.trim());
const cuerpo = filas.slice(1);

console.log(`### Origen: ${CSV}`);
console.log(`  cabecera: ${cabecera.join(" | ")}`);
console.log(`  filas de datos: ${cuerpo.length}`);

const vistoCode = new Set<string>();
const repetidosCode: string[] = [];
const porBarcode = new Map<string, number>();
const sinCodigoImprimible: Array<{ code: string; barcode: string; name: string }> = [];
const controlMalo: Array<{ code: string; barcode: string; name: string; deberia: string }> = [];
const precioCero: string[] = [];
const precioRaro: Array<{ code: string; valor: string }> = [];
const nombresLargos: Array<{ code: string; len: number; name: string }> = [];
const invalidos: Array<{ code: string; errores: string }> = [];
const familias = new Map<string, number>();

const productos: ProductInput[] = [];

for (const f of cuerpo) {
  const numero = (f[0] ?? "").trim();
  const familia = (f[1] ?? "").trim();
  const barcode = (f[2] ?? "").trim();
  const nombre = (f[3] ?? "").trim();
  const precioTxt = (f[4] ?? "").trim();

  if (numero === "" && nombre === "") continue; // fila vacia al final del export

  const code = numero;
  if (code === "") { invalidos.push({ code: "(vacio)", errores: "la columna # esta vacia" }); continue; }
  if (vistoCode.has(code)) repetidosCode.push(code);
  vistoCode.add(code);

  const precio = precioDesde(precioTxt);
  if (precio === null) precioRaro.push({ code, valor: precioTxt });
  else if (precio === 0) precioCero.push(`${code}  ${nombre}  (${precioTxt})`);

  // El barcode se guarda TAL COMO VIENE, sin arreglar. El digito de control se corrige al
  // imprimir, no en el catalogo: asi el archivo sigue siendo una copia fiel del sistema y
  // el error se puede ver y arreglar en el origen.
  porBarcode.set(barcode, (porBarcode.get(barcode) ?? 0) + 1);

  const compacto = barcode.replace(/[\s-]/g, "");
  if (compacto === "" || /^0+$/.test(compacto) || compacto.toLowerCase() === "null") {
    sinCodigoImprimible.push({ code, barcode: barcode === "" ? "(vacio)" : barcode, name: nombre });
  } else if (/^\d{13}$/.test(compacto) && !isValidEan13(compacto)) {
    controlMalo.push({ code, barcode: compacto, name: nombre, deberia: String(ean13CheckDigit(compacto.slice(0, 12))) });
  } else if (/^\d{12}$/.test(compacto) && !isValidEan13("0" + compacto)) {
    const conCero = "0" + compacto;
    controlMalo.push({ code, barcode: compacto, name: nombre, deberia: ean13CheckDigit(conCero.slice(0, 12)) + " (con 0 delante: " + conCero + ")" });
  }

  if (nombre.length > 38) nombresLargos.push({ code, len: nombre.length, name: nombre });
  familias.set(familia, (familias.get(familia) ?? 0) + 1);

  // Se valida contra el esquema REAL, no con una copia: si el importador produce algo que
  // la app va a rechazar al leer, el error sale aqui y no en el escaner.
  const candidato = { code, name: nombre, price: precio ?? -1, reference: familia || code, barcode: barcode === "" ? "-" : barcode };
  const r = productSchema.safeParse(candidato);
  if (!r.success) {
    invalidos.push({ code, errores: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
    continue;
  }
  productos.push(r.data);
}

console.log(`\n### Productos validos para el esquema: ${productos.length}`);
console.log(`  filas descartadas por no validar: ${invalidos.length}`);

const repetidosBarcode = [...porBarcode.entries()]
  .filter(([b, n]) => n > 1 && b !== "" && !/^0*$/.test(b) && b.toLowerCase() !== "null");

console.log("\n### Problemas encontrados (NO se arreglan solos)\n");
console.log(`  codigos de producto repetidos:        ${repetidosCode.length}`);
console.log(`  codigos de barra repetidos:           ${repetidosBarcode.length}`);
repetidosBarcode.forEach(([b, n]) => {
  console.log(`      "${b}" x${n}`);
  productos.filter((p) => p.barcode === b).forEach((p) => console.log(`        ${p.code}  $${p.price}  ${p.name}`));
});
console.log(`  sin codigo imprimible ("0"/"null"):   ${sinCodigoImprimible.length}`);
sinCodigoImprimible.forEach((p) => console.log(`      ${p.code}  "${p.barcode}"  ${p.name}`));
console.log(`  digito de control que no cuadra:     ${controlMalo.length}`);
controlMalo.forEach((p) => console.log(`      ${p.code}  ${p.barcode}  deberia acabar en ${p.deberia}  ${p.name}`));
console.log(`  precio 0,00:                          ${precioCero.length}`);
precioCero.forEach((p) => console.log(`      ${p}`));
console.log(`  precio ilegible:                      ${precioRaro.length}`);
precioRaro.forEach((p) => console.log(`      ${p.code}  "${p.valor}"`));
console.log(`  nombres de mas de 38 caracteres:      ${nombresLargos.length}`);
const longitudes = productos.map((p) => p.name.length).sort((a, b) => a - b);
console.log(`  longitud de nombre: min=${longitudes[0]} p50=${longitudes[Math.floor(longitudes.length / 2)]} p99=${longitudes[Math.floor(longitudes.length * 0.99)]} max=${longitudes[longitudes.length - 1]}`);
console.log(`  familias: ${familias.size}`);
if (invalidos.length > 0) {
  console.log("\n  filas que NO validan:");
  invalidos.forEach((i) => console.log(`      ${i.code}: ${i.errores}`));
}

const json = JSON.stringify(productos, null, 2) + "\n";
console.log(`\n### Lo que se escribiria en ${SALIDA}: ${(json.length / 1024).toFixed(0)} KB, ${productos.length} productos`);

if (!ESCRIBIR) {
  console.log("\n(sin --escribir no se toca nada; se ha mostrado el resultado en pantalla)");
  process.exit(0);
}

// Copia del catalogo anterior antes de sobrescribir: no hay git en este proyecto y este
// archivo se puede tocar desde la web en la fase Carro.
if (fs.existsSync(SALIDA)) {
  const copia = SALIDA + ".bak";
  fs.copyFileSync(SALIDA, copia);
  console.log(`  copia del anterior: ${copia}`);
}
fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
fs.writeFileSync(SALIDA, json, "utf8");
console.log(`  escrito: ${SALIDA}`);

const lineas: string[] = [];
lineas.push("# Informe de importacion del catalogo");
lineas.push("");
lineas.push(`Generado por \`scripts/importar-catalogo.ts\` desde \`${path.basename(CSV)}\`.`);
lineas.push("");
lineas.push("Este archivo lo genera el importador. **No se edita a mano.**");
lineas.push("");
lineas.push("Los problemas de abajo NO se han arreglado: se anotan para que se arreglen en");
lineas.push("el sistema de origen, no aqui.");
lineas.push("");
lineas.push(`- Productos importados: **${productos.length}**`);
lineas.push(`- Familias: **${familias.size}**`);
lineas.push(`- Descartados por no validar el esquema: **${invalidos.length}**`);
lineas.push("");
lineas.push("## Codigo de barra repetido en dos productos distintos");
lineas.push("");
if (repetidosBarcode.length === 0) {
  lineas.push("Ninguno.");
} else {
  lineas.push("Un codigo de barra identifica UN producto. Con dos, escanear es ambiguo y la");
  lineas.push("app no puede saber cual se quiere. Esto es un error del sistema de origen.");
  lineas.push("");
  repetidosBarcode.forEach(([b, n]) => {
    lineas.push(`- \`${b}\` aparece ${n} veces:`);
    productos.filter((p) => p.barcode === b).forEach((p) => lineas.push(`  - ${p.code} — $${p.price} — ${p.name}`));
  });
}
lineas.push("");
lineas.push("## Productos sin codigo de barras imprimible");
lineas.push("");
lineas.push("En el export estos productos traen `0` o el texto `null` en la columna de codigo.");
lineas.push("La etiqueta sale con nombre y precio, sin codigo.");
lineas.push("");
sinCodigoImprimible.forEach((p) => lineas.push(`- ${p.code} — \`${p.barcode}\` — ${p.name}`));
lineas.push("");
lineas.push("## Digito de control que no cuadra");
lineas.push("");
lineas.push("Un EAN-13 con el digito de control mal se imprime impecable y no lo lee absolutely");
lineas.push("nadie. La app **corrige el ultimo digito al imprimir** y avisa, pero el codigo de");
lineas.push("verdad es el que tiene el digito correcto: hay que arreglarlo en el sistema de origen.");
lineas.push("");
controlMalo.forEach((p) => lineas.push(`- ${p.code} — \`${p.barcode}\` — debería acabar en **${p.deberia}** — ${p.name}`));
lineas.push("");
lineas.push("## Productos a 0,00");
lineas.push("");
lineas.push("No parece venta: la etiqueta saldria con un precio de cero. Conviene revisarlos.");
lineas.push("");
precioCero.forEach((p) => lineas.push(`- ${p}`));
if (precioRaro.length > 0) {
  lineas.push("");
  lineas.push("## Precios ilegibles");
  lineas.push("");
  precioRaro.forEach((p) => lineas.push(`- ${p.code} — \`${p.valor}\` (se guardaron como 0,00)`));
}
lineas.push("");
lineas.push("## Nombres largos");
lineas.push("");
lineas.push(`El nombre mas largo del catalogo es de ${longitudes[longitudes.length - 1]} caracteres.`);
lineas.push("El ancho del nombre en la etiqueta es un punto pendiente de la fase Carro.");
lineas.push("");
nombresLargos.sort((a, b) => b.len - a.len).slice(0, 15)
  .forEach((n) => lineas.push(`- ${String(n.len).padStart(3)} — ${n.name}`));
lineas.push("");

fs.writeFileSync(INFORME, lineas.join("\n"), "utf8");
console.log(`  escrito: ${INFORME}`);
