// Comprobacion puntual del caso que reporto el usuario: 073390055219 (12 digitos).
// Se ejecuta contra el MISMO modulo que usa la API, no contra una copia.
const { planBarcode, barcodeFormat } = require("../.preview-build/src/lib/labels/barcode-plan.js");

const ANCHO = 400; // 50 mm a 8 dots/mm
const ALTO = 72; // 9 mm de barras

const casos = [
  "073390055219", // el que falla
  "810078034100", // UPC-A de ejemplo
  "7598986000709", // EAN-13 bueno
  "740312410281", // control mal (12 digitos)
  "XPROD20220002", // alfanumerico de 13 caracteres
];

for (const c of casos) {
  const p = planBarcode(c, { labelWidthDots: ANCHO, moduleWidthDots: 3 });
  console.log("--- " + c);
  if (p.printable) {
    console.log(
      "    symbologia " + p.symbology +
      "  datos " + p.data +
      "  modulos " + p.modules +
      "  ancho " + p.modules * p.moduleWidth + " dots" +
      "  ancho en mm " + ((p.modules * p.moduleWidth) / 8).toFixed(2),
    );
    if (p.correctedFrom) console.log("    CORREGIDO desde " + p.correctedFrom);
    console.log("    ZPL: " + barcodeFormat(p, ALTO, true).split("\n").join(" "));
  } else {
    console.log("    NO IMPRIMIBLE [" + p.reason + "] " + p.detail);
  }
}
