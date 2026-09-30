// Etiquetas de diagnostico para responder una pregunta que no se puede deducir: QUE
// SUBCONJUNTO DE CODE 128 USA LA IMPRESORA EN MODO AUTOMATICO.
//
// El problema
// -----------
// `202616OZ` (EMBASE 12 OZ, RETAIL) son 8 caracteres alfanumericos. Nuestro codificador,
// `encodeCode128Auto()`, cae en la rama de Code B completo porque el dato tiene letras, y
// eso da 123 modulos: 369 dots a 3 de modulo, mas 30 dots de zona quieta por lado = 429
// dots en una etiqueta de 400. No cabe, y `planBarcode()` lo marca `no-cabe`, asi que la
// etiqueta sale SIN codigo de barras.
//
// Pero la impresora NO USA NUESTRO CODIFICADOR. Recibe `^BC` sin subconjunto y elige el
// suyo. Si optimiza (Code C para la racha de 6 digitos y vuelta a B para "OZ") el simbolo
// son 101 modulos = 303 dots, y SI cabe con 47 dots de margen a cada lado. En ese caso la
// etiqueta SI tiene sitio y estamos descartando productos que caben.
//
// Las dos etiquetas
// -----------------
//   A -> `^BY3` (0,375 mm). Es la de produccion. 123 modulos = 369 dots y solo quedan
//        16 dots de zona quieta a la derecha cuando el simbolo se pone en x=15. La norma
//        pide 10X = 30 dots, asi que un lector serio NO deberia decodificar.
//        Si A SI se escanea, la impresora optimiza.
//   B -> `^BY2` (0,250 mm). Es el CONTROL. 123 modulos = 246 dots y sobran 139, asi que
//        se escanea este haya el subconjunto que haya. Sirve para separar "la impresora y
//        el escaner estan bien" de "en A no cabe".
//        OJO: 0,250 mm esta un 5% por debajo del minimo de ISO/IEC 15420 y por eso esta
//        PROHIBIDO en produccion. Aqui es una sonda de diagnostico, no una propuesta.
//
// Como leer el resultado
// ----------------------
//   A escanea  y  B escanea  ->  la impresora optimiza: 101 modulos. Cabe, y hay que
//                               revisar por que el plan los descarta.
//   A no       y  B escanea  ->  la impresora usa Code B entero: 123 modulos. El plan
//                               tiene razon y `no-cabe` es la respuesta correcta.
//   ninguno                     ->  ni impresora ni escaner. Repetir `Prueba Rueda`.
//
// Ejecutar:  node .preview-build/scripts/generar-prueba-symbology.js
// Imprime los dos ZPL y el comando exacto para cada uno.

import { encodeCode128 } from "../src/lib/labels/code128";

const DATOS = "202616OZ";
const ANCHO = 400; // 50 mm a 8 dots/mm
const ALTO = 200; // 25 mm
const X = 15; // el mismo origen de las dos, para poder comparar
const Y = 30;
const ALTURA_BARRAS = 110;

/**
 * Subconjunto OPTIMO teorico, solo como referencia.
 *
 * No es codigo de produccion: `encodeCode128Auto()` no hace esto, y no se le va a pedir
 * que lo haga hasta que la prueba fisica diga si la impresora lo hace. Sirve para saber
 * cuanto COBRARIA la impresora si optimiza, que es el numero contra el que se compara lo
 * que sale impreso.
 */
/**
 * Subconjunto OPTIMO teorico, solo como referencia. No es codigo de produccion.
 *
 * Code C solo empaqueta digitos y en cantidad PAR, y cada digito suelto de mas obliga a un
 * Start B de 11 modulos. La cuenta correcta es por racha, no sobre la cadena entera:
 *
 *   "202616OZ" -> "202616" son 6 digitos (par, Code C entero: 3 simbolos) + "OZ" son 2
 *   letras (Code B: 2 simbolos). El Start B va DESPUES, y se cuenta.
 *
 * El codigo anterior calculaba pares sobre la cadena completa y salia con "Start C x4 +
 * Start B x0": ni uno ni otro era verdad para este dato, y daba 90 modulos en vez de 101.
 */
function subconjuntoOptimo(datos: string): { modulos: number; nota: string } {
  let simbolos = 1; // Start C
  const partes: string[] = [];
  let i = 0;
  while (i < datos.length) {
    const digitos = datos.slice(i).match(/^\d+/);
    if (digitos && digitos[0].length >= 2) {
      // Code C come de dos en dos. Si sobra UN digito, se queda para B: meterlo en C
      // obligaria a inventarse un digito de relleno.
      const pareados = digitos[0].length - (digitos[0].length % 2);
      if (pareados > 0) {
        simbolos += pareados / 2;
        partes.push(`C x${pareados / 2} ("${digitos[0].slice(0, pareados)}")`);
        i += pareados;
        continue;
      }
    }
    // Todo lo que no entre en C va en B, del tirón, hasta el proximo digito.
    const letras = datos.slice(i).match(/^[^\d]+/);
    if (letras) {
      simbolos += 1 + letras[0].length; // Start B + un simbolo por caracter
      partes.push(`B x${letras[0].length} ("${letras[0]}")`);
      i += letras[0].length;
      continue;
    }
    simbolos += 1 + 1; // un digito suelto: Start B + el digito
    partes.push(`B x1 ("${datos[i]}")`);
    i += 1;
  }
  simbolos += 1; // digito de control
  return { modulos: simbolos * 11 + 13, nota: partes.join(" + ") };
}

const completo = encodeCode128(DATOS, "B");
const optimo = subconjuntoOptimo(DATOS);

console.log("### " + DATOS + " con " + DATOS.length + " caracteres\n");
console.log("  Code B completo (lo que hace NUESTRO codificador):");
console.log("    " + completo.modules + " modulos  ->  " + completo.modules * 3 + " dots a ^BY3  ->  " +
  ((completo.modules * 3) / 8).toFixed(2) + " mm");
console.log("    ancho total con zona quieta 10X: " + (completo.modules * 3 + 2 * 30) + " dots  (etiqueta: " + ANCHO + ")");
console.log("");
console.log("  Subconjunto OPTIMO (lo que haria una impresora que optimiza):");
console.log("    " + optimo.modulos + " modulos  ->  " + optimo.modulos * 3 + " dots a ^BY3  ->  " +
  ((optimo.modulos * 3) / 8).toFixed(2) + " mm  [" + optimo.nota + "]");
console.log("    ancho total con zona quieta 10X: " + (optimo.modulos * 3 + 2 * 30) + " dots  (etiqueta: " + ANCHO + ")");
console.log("");
console.log("  Diferencia: " + (completo.modules - optimo.modulos) + " modulos = " +
  ((completo.modules - optimo.modulos) * 3) + " dots = " +
  (((completo.modules - optimo.modulos) * 3) / 8).toFixed(2) + " mm");

function etiqueta(by: number, rotulo: string): string {
  const anchoReal = completo.modules * by;
  const quietaDer = ANCHO - X - anchoReal;
  return [
    "^XA",
    "^PW" + ANCHO,
    "^LL" + ALTO,
    "^LH0,0",
    "^FO6,4",
    "^A0N,20,20",
    "^FD" + rotulo + "^FS",
    "^FO" + X + "," + Y,
    "^BY" + by,
    "^BCN," + ALTURA_BARRAS + ",Y,N",
    "^FD" + DATOS + "^FS",
    "^FO" + X + "," + (Y + ALTURA_BARRAS + 6),
    "^A0N,20,20",
    "^FDBY" + by + "  zona quieta der " + quietaDer + " dots^FS",
    "^XZ",
  ].join("\n");
}

const A = etiqueta(3, "PROBA A");
const B = etiqueta(2, "PROBA B CONTROL");

for (const [nombre, zpl] of [["A", A], ["B", B]] as const) {
  console.log("\n" + "=".repeat(72));
  console.log("### ETIQUETA " + nombre + "   (" + zpl.length + " bytes ZPL, " + zpl.split("\n").length + " lineas)");
  console.log("=".repeat(72));
  console.log(zpl);
  const b64 = Buffer.from(zpl, "ascii").toString("base64");
  console.log("\nbase64 (" + b64.length + " caracteres):");
  console.log(b64);
  console.log("\nComando:");
  console.log(
    '  powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\\send-raw.ps1" ' +
      '-Printer "ZDesigner GX420t" -Mode Send -Base64 "' + b64 + '"',
  );
}
