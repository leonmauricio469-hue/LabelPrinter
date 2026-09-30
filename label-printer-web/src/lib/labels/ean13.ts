// EAN-13: digito de control y ancho fijo del simbolo.
//
// El digito de control es el fallo mas desconcertante del tema: un EAN-13 con el
// digito mal se imprime nitido, con buen contraste y buena altura, y no hay lector en
// el mundo que lo decodifique. Por eso se valida aparte de la forma del dato.

/** Un EAN-13 son siempre 95 modulos, sea cual sea el dato. */
export const EAN13_MODULES = 95;

export function isEan13Shape(code: string): boolean {
  return /^\d{13}$/.test(code);
}

/** Digito de control de los primeros 12 digitos. */
export function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    // Positions 1,3,5... (indice par) pesan 1; las pares pesan 3.
    sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(code: string): boolean {
  return isEan13Shape(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

/** Explica por que un codigo no se puede usar como EAN-13, o `null` si esta bien. */
export function ean13Problem(code: string): string | null {
  const compact = code.replace(/[\s-]/g, "");
  if (isEan13Shape(compact)) {
    const expected = ean13CheckDigit(compact.slice(0, 12));
    const actual = Number(compact[12]);
    if (expected !== actual) {
      return `digito de control ${actual}, deberia ser ${expected}`;
    }
    return null;
  }
  return `no son 13 digitos (largo ${compact.length}, solo ${/\d+$/.test(compact) ? "numerico" : "contiene letras"})`;
}
