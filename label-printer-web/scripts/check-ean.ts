// Verifica el digito de control EAN-13 de cada barcode del catalogo.
//
// Un EAN-13 con digito de control malo se IMPRIME perfecto (las barras se ven
// nitidas, con buen contraste y buena altura) y sin embargo ningun lector lo
// decodifica, porque la aritmetica de paridad no cuadra. Es el fallo mas
// desconcertante que hay, asi que conviene poder descartarlo de una vez.
//
// Uso:
//   node .preview-build/scripts/check-ean.js            solo el veredicto
//   node .preview-build/scripts/check-ean.js --todos    el volcado de las 3.080 lineas
//
// QUE ESTO NO ES UNA COMPROBACION DE CODIGO
//
// El catalogo no lo escribe este proyecto: viene de POSADMIN y lo mantiene una persona
// a mano en `catalog.json`. Un digito malo es un problema DEL DATO, no del programa, y
// no se arregla aqui: `planBarcode()` ya lo corrige, avisa y deja el dato feo en el
// origen a proposito (barcode-plan.ts:26-33). Asi que salir con codigo 1 porque el
// origen tiene un error haria que `npm run check` no pueda estar en verde nunca, y un
// gate que nunca puede pasar es un gate que nadie mira.
//
// Por eso solo falla cuando aparece un digito malo NUEVO, con la misma idea que
// SOLAPES_CONOCIDOS en check-zonas.ts: lo que ya se sabe no tapa lo que se acaba de
// romper. La linea que se rompe es la de DEBAJO_DE_DIGITO_MALO.
//
// Cuando sube el numero, el arreglo no es tocar el codigo: es avisar a quien mantiene
// el catalogo de que el codigo 1067 o el 1694 ya no son EAN-13 validos en POSADMIN.
import { readFileSync } from "node:fs";
import { ean13CheckDigit, ean13Problem, isEan13Shape } from "../src/lib/labels/ean13";

const CATALOG = process.argv[2] ?? "data/catalog.json";
const VER_TODO = process.argv.includes("--todos");

/**
 * Digitos de control que YA se sabian malos cuando se escribio este script.
 *
 * Se listan por codigo de producto, no por codigo de barras, para que el mensaje diga
 * "el 1067" y no un numero que el que mantiene el catalogo no reconoce.
 */
const DEBAJO_DE_DIGITO_MALO = new Set(["1067", "1694"]);

const products = JSON.parse(readFileSync(CATALOG, "utf8")) as {
  code: string;
  name: string;
  barcode: string;
}[];

console.log(`Catalogo: ${CATALOG}  (${products.length} productos)`);

let bad = 0;
let notEan = 0;
let ok = 0;
const nuevos: string[] = [];
const lineas: string[] = [];

for (const p of products) {
  const b = p.barcode;

  if (!isEan13Shape(b)) {
    notEan++;
    lineas.push(
      `  ${p.code}  ${b.padEnd(13)}   ${String(b.length).padStart(4)}    -    NO ES EAN-13: ${ean13Problem(b)}`,
    );
    continue;
  }

  const expected = ean13CheckDigit(b.slice(0, 12));
  const actual = Number(b[12]);
  const bien = expected === actual;
  if (bien) ok++;
  else {
    bad++;
    if (!DEBAJO_DE_DIGITO_MALO.has(p.code)) nuevos.push(p.code);
  }

  lineas.push(
    `  ${p.code}  ${b.padEnd(13)}   ${String(b.length).padStart(4)}   ` +
      `${actual}/${expected}   ${bien ? "ok" : "MAL"}`,
  );
}

if (VER_TODO) {
  console.log("\n  code     barcode      largo  check  estado");
  for (const l of lineas) console.log(l);
}

console.log(`\n  ${ok} EAN-13 correctos, ${bad} con digito de control MAL, ${notEan} no EAN-13`);

if (bad > 0) {
  console.log(
    "\n  Un EAN-13 con digito de control malo se imprime bien pero NO lo lee ningun\n" +
      "  lector. Si el escaner falla con estos codigos, el problema es el dato, no la\n" +
      "  impresora. `planBarcode()` ya lo corrige al imprimir y avisa por el escaner.",
  );
}

if (nuevos.length) {
  console.error(
    `\n  DIGITOS DE CONTROL MALOS NUEVOS: ${nuevos.join(", ")}\n` +
      `  Ya se sabian estos: ${[...DEBAJO_DE_DIGITO_MALO].join(", ")}.\n` +
      `  El arreglo no es en este proyecto: es corregir el codigo de barras en el\n` +
      `  origen, o anadir el codigo de producto a DEBAJO_DE_DIGITO_MALO si es que\n` +
      `  ese dato ya jamas fue un EAN-13 y no lo va a ser.`,
  );
  process.exit(1);
}

console.log(
  bad > 0
    ? `  Sin digitos malos nuevos. Siguen los ${[...DEBAJO_DE_DIGITO_MALO].length} conocidos de DEBAJO_DE_DIGITO_MALO.`
    : "  Ningun EAN-13 con el digito de control malo.",
);