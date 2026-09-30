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

/** Cambio de subconjunto dentro del simbolo (no confundir con los Start, 104/105). */
const CODE_C = 99;
const CODE_B = 100;

interface Segment {
  subset: Code128Subset;
  text: string;
}

/**
 * Parte el dato en tramos B y C, cambiando a C solo cuando ahorra modulos.
 *
 * Un par de digitos en C es un simbolo en vez de dos, pero entrar y salir de C cuesta un
 * simbolo cada vez. Salen las reglas de ISO/IEC 15417, anexo E: C compensa con 4 digitos o
 * mas al principio o al final del dato, con 6 o mas en medio, y siempre si el dato entero
 * son digitos en cantidad par. Un tramo impar deja un digito en B: al final del tramo si
 * el dato empieza por el, al principio en otro caso.
 */
function segment(data: string): Segment[] {
  const segments: Segment[] = [];
  const push = (subset: Code128Subset, text: string) => {
    const last = segments[segments.length - 1];
    if (last?.subset === subset) last.text += text;
    else if (text) segments.push({ subset, text });
  };

  let i = 0;
  while (i < data.length) {
    let n = 0;
    while (i + n < data.length && /\d/.test(data[i + n])) n++;

    const atStart = i === 0;
    const atEnd = i + n === data.length;
    let threshold: number;
    if (atStart && atEnd) threshold = 2; // the whole datum is digits
    else if (atStart || atEnd) threshold = 4; // a run at one edge: one switch symbol
    else threshold = 6; // a run in the middle: switch in and switch back out
    if (n === 0 || n < threshold) {
      push("B", data.slice(i, i + Math.max(n, 1)));
      i += Math.max(n, 1);
      continue;
    }

    const run = data.slice(i, i + n);
    if (n % 2 === 0) push("C", run);
    else if (atStart) {
      push("C", run.slice(0, -1));
      push("B", run.slice(-1));
    } else {
      push("B", run[0]);
      push("C", run.slice(1));
    }
    i += n;
  }
  return segments;
}

/**
 * El simbolo Code 128 de un dato, y el `^FD` que hace que la Zebra dibuje ESE simbolo.
 *
 * Antes esto intentaba adivinar la eleccion automatica de ZPL, y el `^FD` se enviaba sin
 * codigo de inicio. La Zebra, en modo N y sin inicio, usa Code B para todo: el ancho medido
 * era el de un simbolo con C y el impreso el de uno en B. En 76 productos B no cabe en el
 * papel (el 246, `47960195602341`: 112 modulos medidos, 189 impresos).
 *
 * Ahora el reparto B/C se decide aqui y viaja explicito en `fieldData` con los codigos de
 * invocacion de `^BC` (`>;` inicio C, `>:` inicio B, `>5` cambio a C, `>6` cambio a B, `><`
 * un `>` literal). El ancho medido y el impreso salen del mismo reparto.
 */
export function encodeCode128Auto(data: string): {
  encoded: Encoded;
  note: string;
  fieldData: string;
} {
  const segments = segment(data);
  const values: number[] = [];
  let fieldData = "";

  segments.forEach((s, index) => {
    if (index === 0) {
      values.push(s.subset === "C" ? START_C : START_B);
      fieldData += s.subset === "C" ? ">;" : ">:";
    } else {
      values.push(s.subset === "C" ? CODE_C : CODE_B);
      fieldData += s.subset === "C" ? ">5" : ">6";
    }

    if (s.subset === "C") {
      for (let i = 0; i < s.text.length; i += 2) values.push(Number.parseInt(s.text.slice(i, i + 2), 10));
      fieldData += s.text;
      return;
    }
    for (const ch of s.text) {
      const v = ch.charCodeAt(0) - 32;
      if (v < 0 || v > 94) throw new Error(`Code B no puede codificar "${ch}"`);
      values.push(v);
    }
    fieldData += s.text.replace(/>/g, "><");
  });

  let checksum = values[0];
  for (let i = 1; i < values.length; i++) checksum += i * values[i];
  checksum %= 103;

  const widths: number[] = [];
  for (const v of [...values, checksum, STOP]) {
    for (const w of PATTERNS[v]) widths.push(Number(w));
  }

  return {
    encoded: { widths, modules: widths.reduce((a, b) => a + b, 0) },
    note: segments.map((s) => `${s.subset}:${s.text}`).join(" + "),
    fieldData,
  };
}
