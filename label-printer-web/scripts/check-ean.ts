// Verifica el digito de control EAN-13 de cada barcode del catalogo.
//
// Un EAN-13 con digito de control malo se IMPRIME perfecto (las barras se ven
// nitidas, con buen contraste y buena altura) y sin embargo ningun lector lo
// decodifica, porque la aritmetica de paridad no cuadra. Es el fallo mas
// desconcertante que hay, asi que conviene poder descartarlo de una vez.
//
// Uso: node .preview-build/scripts/check-ean.js
import { readFileSync } from "node:fs";
import { ean13CheckDigit, ean13Problem, isEan13Shape } from "../src/lib/labels/ean13";

const CATALOG = process.argv[2] ?? "data/catalog.json";

const products = JSON.parse(readFileSync(CATALOG, "utf8")) as {
  code: string;
  name: string;
  barcode: string;
}[];

console.log(`Catalogo: ${CATALOG}  (${products.length} productos)\n`);
console.log("  code     barcode      largo  check  estado");

let bad = 0;
let notEan = 0;

for (const p of products) {
  const b = p.barcode;

  if (!isEan13Shape(b)) {
    notEan++;
    console.log(
      `  ${p.code}  ${b.padEnd(13)}   ${String(b.length).padStart(4)}    -    NO ES EAN-13: ${ean13Problem(b)}`,
    );
    continue;
  }

  const expected = ean13CheckDigit(b.slice(0, 12));
  const actual = Number(b[12]);
  const ok = expected === actual;
  if (!ok) bad++;

  console.log(
    `  ${p.code}  ${b.padEnd(13)}   ${String(b.length).padStart(4)}   ` +
      `${actual}/${expected}   ${ok ? "ok" : "MAL"}`,
  );
}

console.log(
  `\n  ${products.length - bad - notEan} ok, ${bad} con digito de control MAL, ${notEan} no EAN-13`,
);
if (bad > 0) {
  console.log(
    "\n  ATENCION: un EAN-13 con digito de control malo se imprime bien pero NO lo lee\n" +
      "  ningun lector. Si el escaner falla con estos codigos, el problema es el dato,\n" +
      "  no la impresora.",
  );
  process.exitCode = 1;
}
