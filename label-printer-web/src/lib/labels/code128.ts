// Calculo de anchos de simbolo en modulos, sin dibujar nada.
//
// Vive en `src/lib/labels` y no en `scripts` porque de esto depende `zpl.builder.ts`:
// el ancho del simbolo decide donde va la zona quieta, y si el ancho real no cabe en
// la etiqueta las barras se salen del papel.
//
// Cada patron son 6 anchos (barra, espacio, barra, espacio, barra, espacio) de un
// simbolo, sumando 11 modulos. El patron de parada tiene 7 y suma 13.
// Referencia: ISO/IEC 15417.
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312",
  "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
  "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
  "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
  "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
  "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
  "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
  "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112",
  "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
  "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412",
  "211214", "211232", "2331112",
];

const START_B = 104;
const START_C = 105;
const STOP = 106;

export type Code128Subset = "B" | "C";

export interface Encoded {
  /** anchos alternos en modulos, empezando por barra */
  widths: number[];
  /** total de modulos: la suma de `widths` */
  modules: number;
}

/** Code C solo empaqueta digitos, y en cantidad par. */
export function isCodeC(data: string): boolean {
  return data.length >= 2 && data.length % 2 === 0 && /^\d+$/.test(data);
}

export function encodeCode128(data: string, subset: Code128Subset): Encoded {
  const values: number[] = [];

  if (subset === "C") {
    if (!isCodeC(data)) {
      throw new Error(`Code C necesita digitos en cantidad par, recibio "${data}"`);
    }
    for (let i = 0; i < data.length; i += 2) {
      values.push(Number.parseInt(data.slice(i, i + 2), 10));
    }
  } else {
    for (const ch of data) {
      const v = ch.charCodeAt(0) - 32;
      if (v < 0 || v > 94) {
        throw new Error(`Code B no puede codificar "${ch}"`);
      }
      values.push(v);
    }
  }

  const start = subset === "C" ? START_C : START_B;
  let checksum = start;
  values.forEach((v, i) => {
    checksum += (i + 1) * v;
  });
  checksum %= 103;

  const widths: number[] = [];
  const emit = (value: number) => {
    for (const w of PATTERNS[value]) widths.push(Number(w));
  };

  emit(start);
  for (const v of values) emit(v);
  emit(checksum);
  emit(STOP);

  return { widths, modules: widths.reduce((a, b) => a + b, 0) };
}

/**
 * Reproduce la eleccion de subconjunto automatica de ZPL (`^BC` sin parametro `m`).
 *
 * El dato del catalogo son 13 digitos: cantidad impar, que no entra en Code C de
 * corrido. Lo mas corto es Start C + 6 pares + Start B + 1 digito, y ese Start B de
 * en medio cuenta como un simbolo mas de 11 modulos. Por eso `^BY2 ^BC` con 13
 * digitos ocupa 123 modulos y no los 112 de una estimacion ingenua.
 *
 * Con 12 digitos (cantidad par) entra en Code C completo: 101 modulos. Que el ancho
 * cambie con el dato es exactamente la razon por la que el catalogo se imprime como
 * EAN-13, que siempre son 95 modulos.
 */
export function encodeCode128Auto(data: string): { encoded: Encoded; note: string } {
  if (/^\d+$/.test(data)) {
    if (data.length % 2 === 1) {
      const pairs = data.slice(0, data.length - 1);
      const last = data.slice(-1);
      const values: number[] = [START_C];
      for (let i = 0; i < pairs.length; i += 2) {
        values.push(Number.parseInt(pairs.slice(i, i + 2), 10));
      }
      values.push(START_B);
      values.push(last.charCodeAt(0) - 32);

      let checksum = values[0];
      for (let i = 1; i < values.length; i++) checksum += i * values[i];
      checksum %= 103;

      const widths: number[] = [];
      const emit = (v: number) => {
        for (const w of PATTERNS[v]) widths.push(Number(w));
      };
      emit(values[0]);
      for (const v of values.slice(1)) emit(v);
      emit(checksum);
      emit(STOP);
      return {
        encoded: { widths, modules: widths.reduce((a, b) => a + b, 0) },
        note: `Start C x${pairs.length / 2} + Start B x1 (${data.length} digitos impares)`,
      };
    }
    return {
      encoded: encodeCode128(data, "C"),
      note: `Code C completo (${data.length} digitos)`,
    };
  }

  return { encoded: encodeCode128(data, "B"), note: "Code B (alfanumerico)" };
}
