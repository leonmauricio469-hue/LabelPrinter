/**
 * Decide que symbologia puede usar CADA codigo del catalogo real.
 *
 * No convierte nada. La pregunta que responde es cual de las tres salidas posibles le toca
 * a cada fila, porque con el catalogo inventado (12 productos, todos EAN-13) la pregunta no
 * existia: era "todo EAN-13". Con el catalogo real la respuesta es "casi nada".
 *
 * Ejecutar:  node .preview-build\scripts\analiza-codigos.js <csv>
 */
import fs from "node:fs";
import { ean13CheckDigit, isValidEan13 } from "../src/lib/labels/ean13";

const CSV = process.argv[2] ?? ".tmp-catalogo.csv";

function parseDelimited(text: string): string[][] {
  const filas: string[][] = [];
  let campo = "";
  let fila: string[] = [];
  let enComillas = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (enComillas) {
      if (ch === '"') {
        if (text[i + 1] === '"') { campo += '"'; i++; } else enComillas = false;
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
const datos = filas.slice(1).map((f) => ({
  barcode: (f[2] ?? "").trim(),
  nombre: (f[3] ?? "").trim(),
  precio: (f[4] ?? "").trim(),
  familia: (f[1] ?? "").trim(),
}));

type Veredicto =
  | "ean13_valido"        // se imprime tal cual con ^BE
  | "ean13_control_malo"  // 13 digitos, pero el digito de control no cuadra
  | "upc12_a_ampliar"     // 12 digitos: se puede imprimir como EAN-13 con un 0 delante
  | "code128"             // alfanumerico o longitud que no es 12/13
  | "no_imprimible";      // vacio, "0", o basura: no hay nada que escanear

const veredictos = new Map<Veredicto, { n: number; ejemplos: string[] }>();
function anotar(v: Veredicto, ej: string) {
  const e = veredictos.get(v) ?? { n: 0, ejemplos: [] };
  e.n++;
  if (e.ejemplos.length < 4) e.ejemplos.push(ej);
  veredictos.set(v, e);
}

for (const d of datos) {
  const b = d.barcode;
  const compacto = b.replace(/[\s-]/g, "");
  if (b === "" || compacto === "" || /^0+$/.test(compacto)) {
    anotar("no_imprimible", `"${b}"  ${d.nombre}`);
  } else if (/^\d{13}$/.test(compacto)) {
    if (isValidEan13(compacto)) anotar("ean13_valido", `${compacto}  ${d.nombre}`);
    else anotar("ean13_control_malo", `${compacto}  (control deberia ser ${ean13CheckDigit(compacto.slice(0,12))})  ${d.nombre}`);
  } else if (/^\d{12}$/.test(compacto)) {
    anotar("upc12_a_ampliar", `${compacto}  ${d.nombre}`);
  } else {
    anotar("code128", `${b}  ${d.nombre}`);
  }
}

console.log(`### Los ${datos.length} codigos, clasificados\n`);
const orden: Veredicto[] = ["ean13_valido", "upc12_a_ampliar", "ean13_control_malo", "code128", "no_imprimible"];
const etiqueta: Record<Veredicto, string> = {
  ean13_valido: "EAN-13 valido (imprimible tal cual con ^BE)",
  upc12_a_ampliar: "12 digitos: UPC-A, imprimible como EAN-13 anteponiendo un 0",
  ean13_control_malo: "13 digitos pero el digito de control NO cuadra",
  code128: "Alfanumerico o longitud rara: solo Code 128",
  no_imprimible: "Vacio o '0': no hay nada que escanear",
};
for (const v of orden) {
  const e = veredictos.get(v);
  if (!e) continue;
  const pctv = ((e.n / datos.length) * 100).toFixed(1);
  console.log(`  ${String(e.n).padStart(5)}  ${pctv.padStart(5)}%   ${etiqueta[v]}`);
  e.ejemplos.forEach((x) => console.log(`           ej. ${x}`));
}

console.log("\n### Que se imprimiria con el codigo tal cual (sin tocar nada)");
const talCual = datos.filter((d) => isValidEan13(d.barcode.replace(/[\s-]/g, ""))).length;
console.log(`  ${talCual} de ${datos.length}  (${((talCual / datos.length) * 100).toFixed(1)}%)`);
console.log(`  las otras ${datos.length - talCual} darÃ­an 422 en POST /api/labels tal y como esta hoy`);

console.log("\n### Si se aceptara el 0 delante de los UPC-A");
{
  const upc = [...veredictos.get("upc12_a_ampliar") ? datos.filter((d) => /^\d{12}$/.test(d.barcode.replace(/[\s-]/g, ""))) : []];
  const bien = upc.filter((d) => isValidEan13("0" + d.barcode)).length;
  console.log(`  ${bien} de ${upc.length} codigos de 12 digitos tienen digito de control valido como EAN-13 con 0 delante`);
  if (upc.length - bien > 0) {
    console.log("  los que NO:");
    upc.filter((d) => !isValidEan13("0" + d.barcode)).slice(0, 8)
      .forEach((d) => console.log(`    ${d.barcode}  ${d.nombre}`));
  }
}

console.log("\n### El caso de los codigos de 12 digitos, mirado de verdad");
{
  const upc = datos.filter((d) => /^\d{12}$/.test(d.barcode.replace(/[\s-]/g, "")));
  const muestra = upc.slice(0, 10);
  muestra.forEach((d) => {
    const c = d.barcode;
    // UPC-A: 11 digitos + control. EAN-13 con 0 delante tiene el MISMO digito de control.
    const esperadoUpc = ean13CheckDigit(c.slice(0, 11) + "0").toString();
    console.log(`    ${c}  control=${c[11]}  esperado(UPC)=${esperadoUpc}  ${c[11] === esperadoUpc ? "ok" : "MAL"}`);
  });
}

console.log("\n### Ancho del simbolo, segun symbologia (modulos)");
console.log("  EAN-13   95 modulos fijos  -> el ancho no depende del dato. Cabe de sobra en 50 mm.");
console.log("  Code 128 automatico: 11 digitos = 107, 13 digitos = 123, 14 alfanumericos = 142");
console.log("  A 0,375 mm por modulo (^BY3): 142 modulos = 53,2 mm  -> NO CABE en una etiqueta de 50 mm");
console.log("  A 0,250 mm por modulo (^BY2): 142 modulos = 35,5 mm  -> cabe, pero el modulo queda en el minimo");
console.log("  Conclusion: los codigos de 13-15 caracteres NO se pueden imprimir como EAN-13 de ninguna forma,");
console.log("             porque EAN-13 solo admite digitos. La unica salida es Code 128.");

console.log("\n### Los codigos que necesitarian Code 128, con su longitud");
{
  const c128 = datos.filter((d) => {
    const c = d.barcode.replace(/[\s-]/g, "");
    return !(isValidEan13(c)) && !/^0+$/.test(c) && c !== "" && !/^\d{12}$/.test(c);
  });
  const lens = new Map<number, number>();
  c128.forEach((d) => lens.set(d.barcode.length, (lens.get(d.barcode.length) ?? 0) + 1));
  [...lens.entries()].sort((a, b) => b[1] - a[1]).forEach(([l, n]) => console.log(`    ${String(l).padStart(2)} caracteres: ${n}`));
  console.log("  ejemplos:");
  c128.slice(0, 12).forEach((d) => console.log(`    ${d.barcode.padEnd(20)} ${d.nombre}`));
}
