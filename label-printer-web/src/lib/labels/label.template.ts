import { LOGO_DOTS_W, LOGO_GF } from "./pa-picar-logo";
import type { LabelData } from "./label.types";

export const MM_TO_DOTS = 8;

export function dotsFromMm(mm: number): number {
  return Math.round(mm * MM_TO_DOTS);
}

export interface TextZone {
  kind: "text";
  x: number;
  y: number;
  format: string;
  source: keyof LabelData | "header";
  header?: string;
  prefix?: string;
  /** ancho maximo en dots; activa ^FB para ajustar el texto en varias lineas */
  maxWidthDots?: number;
  /** numero maximo de lineas cuando maxWidthDots esta definido */
  maxLines?: number;
  /** alineacion horizontal dentro de maxWidthDots */
  justify?: "L" | "C" | "R";
}

export type BarcodeSymbology = "ean13" | "code128";

export interface BarcodeZone {
  kind: "barcode";
  x: number;
  y: number;
  /**
   * La zona NO lleva el comando ZPL. Lo construye `barcodeFormat()` a partir de estos
   * campos y de lo que decida `planBarcode()`, porque el comando depende de la
   * symbologia (`^BE` o `^BC`) y esa no se sabe hasta ver el codigo del producto. Con el
   * `format` escrito a mano en la plantilla habia dos verdades y ganaba la que nadie
   * revisaba.
   */
  heightDots: number;
  /** imprime la linea de interpretacion con los digitos debajo de las barras */
  interpretationLine: boolean;
  source: "barcode";
  /** centra el barcode horizontalmente usando el ancho real del simbolo */
  center?: boolean;
  /** ancho de modulo permitido; el plan no baja de aqui por mucho que el codigo sea largo */
  moduleWidth: number;
}

export interface GraphicZone {
  kind: "graphic";
  x: number;
  y: number;
  /** comando ZPL completo, por ejemplo ^GFA,...^FS */
  gf: string;
}

export type LabelZone = TextZone | BarcodeZone | GraphicZone;

export interface LabelTemplate {
  widthDots: number;
  heightDots: number;
  zones: LabelZone[];
  /**
   * Zonas a usar cuando el producto NO tiene codigo imprimible.
   *
   * Sin esta lista, 269 de los 3080 productos del catalogo real (el 8,7%) saldrian con el
   * logo, el nombre y el precio arriba, y los 12,5 mm de abajo en blanco. Se decide aqui y
   * no en el constructor para que `buildZpl()` siga siendo un traductor de zonas a ZPL.
   *
   * PROVISIONAL: son cuatro coordenadas puestas a ojo, sin poder ver la etiqueta impresa.
   * Las revisa la fase Carro del editor de plantillas, que es donde el aspecto de la
   * etiqueta se resuelve de verdad.
   */
  zonesWithoutBarcode?: LabelZone[];
}

// Layout for 50 x 25 mm @ 203 dpi (8 dots/mm) = 400 x 200 dots, landscape.
// Every ^A0N command sets BOTH height and width: ZPL defaults char width to the
// height value, which is what made long names and the price run off the label.
//
// La symbologia NO se decide aqui. La decide `planBarcode()`, producto a producto, porque
// con el catalogo real de PA PICAR (3080 productos) no todos los codigos son EAN-13 y forzar
// uno solo se salia del papel en 6 de cada 10 productos. Reparto real:
//
//   2250 productos  EAN-13  (^BE, 95 modulos fijos, el ancho no depende del dato)
//     1180 con 13 digitos y el control correcto
//     1064 UPC-A de 12 digitos, impresos con un 0 delante
//        (un UPC-A ES un EAN-13 con 0 delante: no es una convencion, sigue siendo valido)
//       6 con el digito de control mal, corregido al imprimir y avisado
//    561 productos  Code 128 (^BC, el ancho SI depende del dato)
//    269 productos  sin codigo: 264 no caben a 3 de modulo y 5 no traen codigo en origen
//
// Por que 3 dots y no 2:
//
//   El minimo de X en ISO/IEC 15420 es 0,264 mm. 3 dots son 0,375 mm, por encima. 2 dots
//   son 0,250 mm, un 5% por debajo, y con el sangrado termico de un cabeza a 203 dpi las
//   barras estrechas se cierran. A 2 de modulo cabrian 180 modulos en vez de 113, y con
//   eso 182 productos mas tendrian codigo, pero de los que se escanean en caja solo
//   pasarian de 29 a 2 sin codigo. Se eligio respetar la norma antes que eso: son 29
//   productos de RETAIL, y se imprimen con nombre y precio a la espera de una decision
//   sobre la medida de la etiqueta.
//
// Altura 72 dots = 9 mm, por encima del minimo practico de 6,64 mm (con 6 mm las barras
// no las leian los escaneres; ese fue el primer bug de legibilidad).
export const DEFAULT_TEMPLATE: LabelTemplate = {
  widthDots: dotsFromMm(50),
  heightDots: dotsFromMm(25),
  zones: [
    // 1. Logo, centred: 200 x 67 dots, x = (400 - 200) / 2 = 100, y 1..68
    {
      kind: "graphic",
      x: Math.round((dotsFromMm(50) - LOGO_DOTS_W) / 2),
      y: 1,
      gf: LOGO_GF,
    },
    // 2. Description, 8 dots/char, one line inside 240 dots, y 70..84
    {
      kind: "text",
      x: 6,
      y: 70,
      format: "^A0N,14,8",
      source: "productName",
      maxWidthDots: 240,
      maxLines: 1,
      justify: "L",
    },
    // 3. Price: "$7.80" = 5 x 15 = 75 dots, x 250..325, y 68..92
    {
      kind: "text",
      x: 250,
      y: 68,
      format: "^A0N,24,15",
      source: "price",
      prefix: "$",
    },
    // 4. Barcode, centrado. Con EAN-13 son 95 modulos x 3 dots = 285 dots,
    //    x = (400 - 285) / 2 = 58 -> zonas quietas de 58 y 57 dots (7,1 mm), mucho por
    //    encima de las 10X (30 dots) que pide la norma. Con Code 128 el ancho se calcula
    //    con el codigo real y la zona quieta se comprueba antes de imprimir.
    //    Barras y 96..168; la linea de interpretacion acaba hacia 182.
    {
      kind: "barcode",
      x: 0,
      y: 96,
      heightDots: 72,
      interpretationLine: true,
      source: "barcode",
      center: true,
      moduleWidth: 3,
    },
    // 5. Reference, y 186..198
    {
      kind: "text",
      x: 6,
      y: 186,
      format: "^A0N,12,8",
      source: "reference",
      prefix: "REF: ",
    },
  ],

  /**
   * Etiqueta sin codigo de barras: los 269 productos cuyo codigo no cabe a 3 de modulo, o
   * que en el export vienen como "0" y "null".
   *
   * Se reparte el alto de 200 dots entre logo, nombre, precio y referencia, con el nombre
   * y el precio centrados y mas grandes, que es lo que se ve de lejos. Los nombres mas
   * largos del catalogo son de 50 caracteres y caben en 3 lineas de 384 dots a 14 dots de
   * ancho de caracter (27 caracteres por linea).
   *
   * Las coordenadas son provisionales: estan puestas a ojo y sin ver la etiqueta impresa.
   */
  zonesWithoutBarcode: [
    // 1. Logo, centrado: 200 x 67 dots, y 1..68
    {
      kind: "graphic",
      x: Math.round((dotsFromMm(50) - LOGO_DOTS_W) / 2),
      y: 1,
      gf: LOGO_GF,
    },
    // 2. Nombre: hasta 3 lineas de 384 dots, centradas, y 74..116
    {
      kind: "text",
      x: 8,
      y: 74,
      format: "^A0N,16,14",
      source: "productName",
      maxWidthDots: 384,
      maxLines: 3,
      justify: "C",
    },
    // 3. Precio grande y centrado, y 126..164
    {
      kind: "text",
      x: 8,
      y: 126,
      format: "^A0N,34,24",
      source: "price",
      prefix: "$",
      maxWidthDots: 384,
      maxLines: 1,
      justify: "C",
    },
    // 4. Referencia, al pie, y 182..194
    {
      kind: "text",
      x: 8,
      y: 182,
      format: "^A0N,12,8",
      source: "reference",
      prefix: "REF: ",
      maxWidthDots: 384,
      maxLines: 1,
      justify: "C",
    },
  ],
};
