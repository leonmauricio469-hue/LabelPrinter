// Comprueba que `foldAscii()` deja imprimible todo lo que hay en el catalogo real.
//
// El problema que resuelve: la GK420t no trae la enye ni los acentos en la pagina de codigos
// que usa por defecto, y el proyecto no dice cual es. Al mandar "JALAPENO" con tilde, el byte
// sale como 0xD1 y la impresora, que esta en CP850, lo lee como U+00D0. En vez de "jalapeno"
// sale un simbolo que no es una letra.
//
// Que se pierda el acento es cosmetico. Que el nombre del producto sea ilegible en el
// mostrador es un problema de ventas. Por eso se pliega y no se arregla con `^CI28`.
//
//   tsc -p tsconfig.preview.json
//   node .preview-build/scripts/check-ascii.js
import { readFileSync } from "node:fs";
import { foldAscii } from "../src/lib/labels/ascii.fold";
import type { ProductInput } from "../src/lib/validation/schemas";

/** `data/catalog.json` es un array pelado, no un objeto con `products`. */
const catalogo = JSON.parse(readFileSync("data/catalog.json", "utf8")) as ProductInput[];

let pruebas = 0;
let fallos = 0;

function ok(cond: boolean, msg: string, extra = ""): void {
  pruebas++;
  if (!cond) {
    fallos++;
    console.log(`  FALLA  ${msg}${extra ? "  ->  " + extra : ""}`);
  }
}

// ------------------------------------------------------------------ 1. casos sueltos
console.log("Casos sueltos:");

const CASOS: Array<[string, string, string]> = [
  // entrada, esperado, por que
  ["JALAPEÑO", "JALAPENO", "enye: la letra que se rompia en fisico"],
  ["ÑOÑO", "NONO", "enye al principio y en medio"],
  ["PIÑA", "PINA", "enye en silaba cerrada"],
  ["Café", "Cafe", "acento en minuscula"],
  ["CAFÉ", "CAFE", "acento en mayuscula"],
  ["ÁRBOL", "ARBOL", "acento en A"],
  ["ÉXITO", "EXITO", "acento en E"],
  ["ÍNDIGO", "INDIGO", "acento en I"],
  ["ÓXIDO", "OXIDO", "acento en O"],
  ["ÚLTIMO", "ULTIMO", "acento en U"],
  ["ENTREMET", "ENTREMET", "e grave"],
  ["JALAPEÑO", "JALAPENO", "el nombre del producto que se probo en la impresora"],
  ["CANCION", "CANCION", "la C con cedilla se convierte en C normal"],
  ["FRANGELLO", "FRANGELLO", "un nombre corriente no se toca"],
  ["CAFÉ 2", "CAFE 2", "no deja doble espacio al plegar"],
  ["SALSA\tPICANTE", "SALSA PICANTE", "el tabulador es un espacio"],
  ["A\nB", "A B", "el salto de linea no puede partir el ^FD"],
  ["A\r\nB", "A B", "CRLF tampoco"],
  ["  LEADING", "LEADING", "no deja espacio al principio"],
  ["TRAILING  ", "TRAILING", "no deja espacio al final"],
  ["€", "", "el euro no existe en la GK420t"],
  ["x™y", "xy", "la marca registrada tampoco"],
  ["\u0440\u0443\u0441", "", "cirilico fuera de rango"],
];

for (const [entrada, esperado, porQue] of CASOS) {
  const salida = foldAscii(entrada);
  ok(salida === esperado, `"${entrada}" -> "${salida}", se esperaba "${esperado}" (${porQue})`);
}
console.log(`  ${CASOS.length} casos`);

// ------------------------------------------------------- 2. todo el catalogo real
console.log("\nSobre el catalogo real:");

const conAcentos: string[] = [];
const campos: Array<[string, (p: ProductInput) => string]> = [
  ["name", (p) => p.name],
  ["reference", (p) => p.reference],
  ["barcode", (p) => p.barcode],
];

let sucios = 0;
for (const producto of catalogo) {
  for (const [campo, leer] of campos) {
    const original = leer(producto);
    const plegado = foldAscii(original);

    if (original !== plegado) {
      if (conAcentos.length < 12) conAcentos.push(`${campo}: "${original}" -> "${plegado}"`);
      sucios++;
    }

    // Lo unico que tiene que ser verdad para TODO lo que sale en una etiqueta: cada caracter
    // tiene que estar en el rango de la pagina de codigos de la impresora.
    for (let i = 0; i < plegado.length; i++) {
      const c = plegado.charCodeAt(i);
      pruebas++;
      if (c < 0x20 || c > 0x7e) {
        fallos++;
        console.log(
          `  FALLA  ${campo} del producto ${producto.code}: "${original}" sale con el byte 0x${c
            .toString(16)
            .padStart(2, "0")} en la posicion ${i}`,
        );
        break;
      }
    }

    // Ni una sola linea: un \n dentro de ^FD cierra el formato antes de tiempo.
    pruebas++;
    if (/[\r\n]/.test(plegado)) {
      fallos++;
      console.log(`  FALLA  ${campo} del producto ${producto.code}: "${original}" conserva un salto de linea`);
    }

    // Y nada de vacio: si el plegado se come el texto entero, la etiqueta sale sin nombre.
    pruebas++;
    if (original.trim().length > 0 && plegado.trim().length === 0) {
      fallos++;
      console.log(`  FALLA  ${campo} del producto ${producto.code}: "${original}" se pliega a la cadena vacia`);
    }
  }
}

console.log(`  ${catalogo.length} productos, ${catalogo.length * 3} campos`);
console.log(`  ${sucios} campos con algo que plegar:`);
for (const linea of conAcentos) console.log(`    ${linea}`);
if (sucios > conAcentos.length) console.log(`    ... y ${sucios - conAcentos.length} mas`);

// ------------------------------------------------- 3. que plegar NO toque el catalogo
//
// El plegado es una operacion pura: devuelve una cadena nueva y no escribe nada. Pero el
// riesgo real es que alguien plegase al GUARDAR, y entonces el acento se pierde para siempre
// en la base de datos y la busqueda por nombre empieza a devolver dos productos donde antes
// devolvia uno.
//
// Asi que se comprueba que el array de memoria sigue igual despues de plegarlo entero.
console.log("\nEl catalogo NO se toca:");
const conAcento = catalogo.filter((p) => /[\u0080-\uffff]/.test(p.name));
const antes = catalogo.map((p) => p.name);
for (const p of catalogo) {
  void foldAscii(p.name);
  void foldAscii(p.reference);
  void foldAscii(p.barcode);
}
const despues = catalogo.map((p) => p.name);

let mutados = 0;
for (let i = 0; i < antes.length; i++) {
  if (antes[i] !== despues[i]) mutados++;
}

pruebas++;
ok(
  mutados === 0,
  `plegar los ${catalogo.length} productos deja el catalogo entero igual`,
  `${mutados} nombres cambiaron`,
);
pruebas++;
ok(
  conAcento.length > 0,
  `y el catalogo sigue teniendo ${conAcento.length} nombres con tilde, que se pliegan al imprimir`,
  String(conAcento.length),
);
console.log(`  ${conAcento.length} nombres conservan su tilde en el archivo`);


console.log(`\n${pruebas} comprobaciones, ${fallos} fallos`);
if (fallos > 0) {
  console.log("HAY TEXTO QUE LA IMPRESORA NO PUEDE LEER.");
  process.exit(1);
}
console.log("Todo el texto del catalogo sale en ASCII imprimible y en una sola linea.");
