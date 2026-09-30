// La GK420t no trae todos los caracteres del español en la pagina de codigos que usa por
// defecto, y el proyecto no dice cual es: `zpl.builder.ts` emite ^XA/^PW/^LL/^LH y nada mas.
// Asi que la impresora decide, y decide mal. La enye U+00D1 sale como el byte 0xD1, y la
// GK420t, que esta en CP850, lo lee como U+00D0, que no es una letra.
//
// Hay dos formas de arreglarlo.
//
//   1. ^CI28 + codificar en utf8. Dice explicitamente la pagina de codigos, asi que en teoria
//      es independiente de como tenga la impresora configurada. Es lo correcto.
//
//   2. Plegar el texto a ASCII antes de imprimir. No depende de la impresora, de su firmware
//      ni de su configuracion: si no hay glifo, no hay glifo que imprimir.
//
// Se eligio la segunda porque el rollo de papel se cambia entre maquinas y el catalogo de
// mostrador lo escribe gente distinta. Un plegado no se puede romper; ^CI28 se rompe en
// silencio el dia que alguien cambie la impresora por otra.
//
// Que se pierda el acento es cosmetico. Que el nombre del producto sea ilegible en el
// mostrador es un problema de ventas.

/**
 * Simbolos que no son letras acentuadas y que salen en nombres reales.
 *
 * Las vocales acentuadas NO estan aqui: se resuelven con `normalize("NFD")` mas borrar los
 * signos de combinacion, que es mecanico y no hay que mantener una entrada por cada tilde.
 * Lo que queda en esta tabla es lo que NFD no separa.
 */
const SUSTITUCIONES: Record<string, string> = {
  // El apostrofo latino. En `data/catalog.json` hay 13 nombres con U+00B4 pegado al
  // nombre en vez de comilla: HERSHEY'S, JACK'S, WELCH'S, PA'PICAR, FLAMIN'HOT. Es un
  // error de tecleo heredado de maquinas de escribir, muy corriente en el comercio.
  // NFD no lo separa (no es un acento de una letra, es un acento suelto), asi que hay que
  // ponerlo a mano. Sin esta linea, esos 13 productos imprimen con el byte 0xB4, que en
  // CP850 no es un apostrofo.
  "\u00b4": "'", // acento agudo suelto, usado como apostrofo
  "\u02bc": "'", // apostrofo modificador
  "\u02bb": "'", // apostrofobbs
  "\u00b0": "o", // grado, se ve en "27 GRADO"
  "\u00ba": "o", // ordinal masculino, "2º"
  "\u00a0": " ", // espacio duro
  "\u2018": "'", // comilla simple izquierda
  "\u2019": "'", // comilla simple derecha
  "\u201c": '"', // comilla doble izquierda
  "\u201d": '"', // comilla doble derecha
  "\u2013": "-", // raya corta
  "\u2014": "-", // raya larga
  "\u2026": "...", // puntos suspensivos
  "\u00d7": "x", // signo de multiplicar
  "\u00f7": "/", // signo de division
  "\u2022": "-", // vineta
  "\u00a9": "(c)", // copyright
};

/** Signos de combinacion: lo que NFD separa de la letra. U+0300 a U+036F. */
const COMBINANTES = /[\u0300-\u036f]/g;

/**
 * Deja el texto en ASCII imprimible y en una sola linea.
 *
 * El plegado de acentos va con `normalize("NFD")`, que separa la letra de su tilde: la enye
 * U+00D1 pasa a "n" + U+0303, y al borrar los signos de combinacion sale una "N". Es la
 * parte importante y la facil de hacer mal: sin el `NFD`, una tabla de sustituciones escrita
 * con los acentos debajo no encuentra NADA en un texto que llega con los acentos encima, que
 * es como estan guardadas las palabras en el catalogo y en el teclado.
 */
export function foldAscii(input: string): string {
  let texto = input.normalize("NFD");

  for (const [buscar, poner] of Object.entries(SUSTITUCIONES)) {
    if (texto.includes(buscar)) texto = texto.split(buscar).join(poner);
  }

  // El acento suelto, sin letra debajo, se va. Un acento sin letra es un byte que la
  // impresora no puede dibujar.
  texto = texto.replace(COMBINANTES, "");

  // Por encima de U+00FF la GK420t no tiene nada que dibujar y el byte se sale del rango de
  // la pagina de codigos. El cirilico y el japones caen aqui.
  texto = texto.replace(/[\u0100-\uffff]/g, "");

  // Controladores fuera del tabulador. Un \n dentro de ^FD cierra el formato antes de tiempo y
  // lo que viene despues se imprime como otro trabajo, o no se imprime.
  texto = texto.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ");

  texto = texto.replace(/[\r\n\t]+/g, " ");

  // El plegado deja huecos donde habia un acento suelto, y un ^FB con dos espacios de
  // separacion no sale centrado.
  texto = texto.replace(/ {2,}/g, " ");
  texto = texto.trim();

  return texto;
}

/** Atajo para las zonas que solo necesitan un `^FD` imprimible. */
export function foldField(input: string | number): string {
  return foldAscii(String(input));
}
