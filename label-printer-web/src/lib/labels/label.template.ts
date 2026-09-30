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
  /**
   * De donde sale el texto.
   *
   * `keyof LabelData` son los campos del producto. Los otros tres los resuelve `buildZpl()`:
   *
   *   "header"        -> `zone.header` o el nombre del negocio
   *   "referenceLabel"-> la palabra "REF:" fija, sin el valor
   *   "barcodeData"   -> los datos REALES del simbolo, desde `plan.data`
   *
   * "barcodeData" existe porque `data.barcode` no siempre es lo que se imprime: a un UPC-A de
   * 12 digitos se le antepone un 0, y a los 6 productos con el digito de control malo se les
   * corrige. Si una zona de texto sacara el numero del producto y no del plan, el codigo de
   * barras y el numero de debajo dirian cosas distintas.
   */
  source: keyof LabelData | "header" | "referenceLabel" | "barcodeData";
  header?: string;
  prefix?: string;
  /** ancho maximo en dots; activa ^FB para ajustar el texto en varias lineas */
  maxWidthDots?: number;
  /** numero maximo de lineas cuando maxWidthDots esta definido */
  maxLines?: number;
  /** alineacion horizontal dentro de maxWidthDots */
  justify?: "L" | "C" | "R";
  /**
   * Reduce el alto de la fuente hasta que el texto quepa en UNA sola linea.
   *
   * `^FB` no hace esto: recorta lo que no cabe y tira el resto sin avisar. Con el catalogo
   * real eso pasaba en 1049 de 3080 productos (34%), y el operador no tenia forma de saberlo
   * porque el corte es invisible en la etiqueta.
   *
   * El calculo es ancho de caracter = `alto * widthRatio`, y se busca el mayor `maxHeight`
   * tal que `caracteres * ancho <= maxWidthDots`. El precio por el alto de la fuente no se
   * calcula: los anchos de `^Af` los decide la fuente de la impresora, y aqui solo se pide
   * el mayor alto que-respeta-el-ancho-de-caja.
   *
   * Solo tiene efecto si `maxWidthDots` esta definido. Si ademas `maxLines` es 1, el texto
   * nunca se parte.
   */
  autoFit?: {
    maxHeight: number;
    minHeight: number;
    /** proporcion del alto que ocupa un caracter de ancho. 0,5 es condensado. */
    widthRatio: number;
  };
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
  /**
   * Alto en dots de la linea de interpretacion que dibuja la impresora bajo las barras.
   *
   * Si se omite, `barcodeFormat()` emite `^BY3` a secas y el alto de la linea de
   * interpretacion cae al valor por defecto, que es la altura de fuente vigente en ese
   * momento. Medido sobre la plantilla de 50 mm, esa fuente es la del precio (`^A0N,24`), y
   * la linea queda en y 168..192 mientras la referencia esta en 186..198: 6 dots de solape.
   *
   * Decirlo a mano lo quita de juego. No se pone por defecto en la de 50 mm porque cambiaria
   * el ZPL que ya se ha impreso en fisico; la de 59 mm si lo dice.
   */
  hriHeightDots?: number;
}

export interface GraphicZone {
  kind: "graphic";
  x: number;
  y: number;
  /** comando ZPL completo, por ejemplo ^GFA,...^FS */
  gf: string;
}

/**
 * Marco, con o sin esquinas redondeadas.
 *
 * ZPL II no tiene un primitivo de rectangulo redondeado. Lo que hay son `^GB` (caja de
 * esquinas vivas), `^GC` (circulo) y `^GD` (diagonal), y un rectangulo redondeado es
 * exactamente cuatro `^GC` de contorno mas cuatro `^GB` tumbados: los circulos tapan las
 * esquinas y los `^GB` cierran los tramos rectos.
 *
 * Con `radiusDots: 0` sale un `^GB` y nada mas, que es el caso normal.
 *
 * Va en su propia zona y no como texto ni como grafico porque es una instruccion de dibujo,
 * no un dato: la plantilla decide donde va el marco, no el producto.
 */
export interface ShapeZone {
  kind: "shape";
  x: number;
  y: number;
  widthDots: number;
  heightDots: number;
  /** Grosor del trazo en dots. 1 dot es 0,125 mm: el trazo fino que se pide. */
  thicknessDots: number;
  /** Radio de las esquinas en dots. 0 = esquinas vivas. */
  radiusDots?: number;
}

export type LabelZone = TextZone | BarcodeZone | GraphicZone | ShapeZone;

export interface LabelTemplate {
  /** Identificador estable. Va a `settings.json` y es lo que se guarda, no el objeto. */
  id: string;
  /** Nombre que ve el operador en /settings. */
  name: string;
  /** Medidas fisicas reales del rollo. Se muestran y se verifican contra la impresora. */
  widthMm: number;
  heightMm: number;
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
  id: "papicar-50x25",
  name: "Papicar 50 x 25 mm (actual)",
  widthMm: 50,
  heightMm: 25,
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

// ---------------------------------------------------------------------------------------
// Papicar 59 x 35 mm
// ---------------------------------------------------------------------------------------
//
// 472 x 280 dots a 203 dpi (8 dots/mm). Horizontal.
//
// MEDIDA FISICA Y CONFIGURACION DE LA IMPRESORA
//
// Los dots de esta plantilla son el ancho de la ZONA IMPRESORA, no el del rollo. La GK420t
// tiene que tener el ancho de medio ajustado a 59 mm (o al rollo que se monte), porque si no
// el sensor deGAP se dispara con el ancho del rollo y el contenido sale corrido hacia un
// lado. `^PW472` por si solo no corrige eso: ^PW recorta, no posiciona. Hay que cambiar el
// medio en la impresora, no solo en el ZPL.
//
// LO QUE NO SE PUDO HACER Y POR QUE
//
// El ancho de barcode pedido son 20,5 mm. Es imposible con EAN-13, que es el 80 % del
// catalogo: son 95 modulos fijos, y el modulo mas estrecho que permite ISO/IEC 15420 es
// 0,264 mm. El piso absoluto son 95 x 0,264 = 25,1 mm, ya por encima de los 20,5 pedidos.
// A 3 dots (0,375 mm, el que respeta el margen de la norma) el simbolo mide 285 dots =
// 35,6 mm.
//
// Con 285 dots de barras mas 30 de zona quieta a cada lado son 345 dots, y a 472 de ancho
// quedan 127 dots (15,9 mm) a la derecha. "REF:" en grande no cabe en 15,9 mm.
//
// Decision: el barcode va centrado y a su ancho natural, y REF baja a su propia linea,
// alineado a la derecha. Es lo unico que cabe para EAN-13 con la norma respetada.
//
// La alternativa es bajar el modulo a 2 dots: 190 dots = 23,75 mm, y ahi REF si cabe al
// lado como en el dibujo original. Es justo lo que la version 1.1 rechazo a proposito,
// porque a 2 dots las barras estrechas se cierran con el sangrado termico de un cabeza a
// 203 dpi. Si se quiere el dibujo original, es una decision de rollo y de modulo, no de
// plantilla, y hay que probarla en fisico antes.
const PAPICAR_59X35: LabelTemplate = {
  id: "papicar-59x35",
  name: "Papicar 59 x 35 mm (nueva)",
  widthMm: 59,
  heightMm: 35,
  widthDots: dotsFromMm(59),
  heightDots: dotsFromMm(35),
  zones: [
    // 1. Marco: 1 mm de margen (8 dots) por los cuatro lados, trazo de 1 dot, esquinas de
    //    2 mm (16 dots). El rectangulo utilizable es 8,8 .. 464,272.
    {
      kind: "shape",
      x: dotsFromMm(1),
      y: dotsFromMm(1),
      widthDots: dotsFromMm(59) - dotsFromMm(2),
      heightDots: dotsFromMm(35) - dotsFromMm(2),
      thicknessDots: 1,
      radiusDots: dotsFromMm(2),
    },
    // 2. Logo, centrado horizontal. El `^GFA` existente mide 200 x 67 dots (25 x 8,4 mm) y
    //    ZPL no escala un campo grafico, asi que se centra al tamaño que hay. Para ocupar
    //    los 35 mm que pide la especificacion habria que regenerar `pa-picar-logo.ts` con
    //    `generate-logo.ps1` a 280 dots de ancho.
    {
      kind: "graphic",
      x: Math.round((dotsFromMm(59) - LOGO_DOTS_W) / 2),
      y: dotsFromMm(2.5),
      gf: LOGO_GF,
    },
    // 3. Nombre: una sola linea, centrada, que baja la fuente hasta que quepa. Ver el
    //    reparto real de anchuras en el comentario de `autoFit` mas abajo.
    {
      kind: "text",
      x: dotsFromMm(8),
      y: dotsFromMm(11.5),
      format: "^A0N,32,16",
      source: "productName",
      maxWidthDots: dotsFromMm(43),
      maxLines: 1,
      justify: "C",
      autoFit: { maxHeight: 32, minHeight: 13, widthRatio: 0.5 },
    },
    // 4. Codigo de barras. 17,5 mm de alto de barra, 72 dots, con la linea de
    //    interpretacion a 14 dots (dicho a mano: si no, ^BY la pone a 30 y pisa REF).
    //    El numero de abajo lo dibuja la propia impresora desde `plan.data`, que ya lleva
    //    el 0 delante de los UPC-A y el digito de control corregido, asi que no puede
    //    desincronizarse del simbolo.
    {
      kind: "barcode",
      x: 0,
      y: dotsFromMm(17.5),
      heightDots: 72,
      interpretationLine: true,
      source: "barcode",
      center: true,
      moduleWidth: 3,
      hriHeightDots: 14,
    },
    // 5. Referencia: "REF:" pequeno e independiente del valor, para poder agrandar el
    //    numero sin arrastrar la palabra.
    //
    //    Vertical: las barras van de y 140 a 212 y la linea de interpretacion de 212 a 226,
    //    asi que la linea de referencia tiene que bajar de 226. Se pone entre 230 y 260, con
    //    el borde interior en 272: quedan 12 dots de aire. La palabra va centrada en el
    //    mismo eje vertical que el precio, de ahi el desfase de 6 dots entre las dos.
    //
    //    Horizontal: los dos cajas terminan en 280 y 448, y la derecha acaba a 8 del borde.
    //    Van con ^FB en justificacion derecha porque un precio de "1234.56" ocupa 119 dots y
    //    uno de "3.00" ocupa 51: si se fijara la x a la izquierda, el numero pegaria al
    //    centro en vez de a la derecha.
    {
      kind: "text",
      x: 240,
      y: 236,
      format: "^A0N,18,9",
      source: "referenceLabel",
      maxWidthDots: 40,
      maxLines: 1,
      justify: "R",
    },
    {
      kind: "text",
      x: 288,
      y: 230,
      format: "^A0N,30,17",
      source: "price",
      // El "$" va aqui y no dentro de `LabelData` porque es una decision de la plantilla, no
      // del producto. La de 50 mm tambien lo lleva, y quitarlo seria un cambio de aspecto en
      // el mostrador sin que nadie lo haya pedido.
      prefix: "$",
      maxWidthDots: 160,
      maxLines: 1,
      justify: "R",
    },
  ],

  /**
   * Sin codigo de barras: los productos cuyo simbolo no cabe o que no traen codigo en origen.
   *
   * Misma logica que la de 50 mm (recomponer la etiqueta entera, no dejar un hueco), pero con
   * el alto que sobra al bajar el nombre y el codigo: 35 mm dan para nombre grande y dos
   * lineas de precio, que es lo que se lee de lejos.
   */
  zonesWithoutBarcode: [
    {
      kind: "shape",
      x: dotsFromMm(1),
      y: dotsFromMm(1),
      widthDots: dotsFromMm(59) - dotsFromMm(2),
      heightDots: dotsFromMm(35) - dotsFromMm(2),
      thicknessDots: 1,
      radiusDots: dotsFromMm(2),
    },
    {
      kind: "graphic",
      x: Math.round((dotsFromMm(59) - LOGO_DOTS_W) / 2),
      y: dotsFromMm(2.5),
      gf: LOGO_GF,
    },
    // Hasta 4 lineas: el nombre mas largo del catalogo son 50 caracteres, y con el alto
    // disponible caben de sobra a tamano legible.
    {
      kind: "text",
      x: dotsFromMm(6),
      y: dotsFromMm(12),
      format: "^A0N,20,10",
      source: "productName",
      maxWidthDots: dotsFromMm(47),
      maxLines: 4,
      justify: "C",
    },
    {
      kind: "text",
      x: dotsFromMm(6),
      y: dotsFromMm(24),
      format: "^A0N,36,19",
      source: "price",
      prefix: "$",
      maxWidthDots: dotsFromMm(47),
      maxLines: 1,
      justify: "C",
    },
    {
      kind: "text",
      x: dotsFromMm(6),
      y: dotsFromMm(29.5),
      format: "^A0N,14,7",
      source: "reference",
      prefix: "REF: ",
      maxWidthDots: dotsFromMm(47),
      maxLines: 1,
      justify: "C",
    },
  ],
};

/**
 * Reparto de anchuras de la zona de nombre de 59 x 35, medido sobre el catalogo real.
 *
 * Con `widthRatio` 0,5 y 344 dots de caja (43 mm), el alto de fuente que sale para cada
 * longitud de nombre es:
 *
 *   27 caracteres (mediana del catalogo)  ->  ancho 12,7  ->  alto 25
 *   37 caracteres (percentil 90)          ->  ancho  9,3  ->  alto 18
 *   46 caracteres (BOMBONES... MORITZ)    ->  ancho  7,5  ->  alto 14
 *   50 caracteres (el maximo del catalogo) ->  ancho  6,9  ->  alto 13
 *
 * O sea: el nombre corto sale grande, el largo sale pequeno, y NUNCA se parte ni se recorta.
 * El minimo de 13 dots son 1,6 mm de alto de letra, por debajo del cual un escaner de mano ya
 * empieza a fallar.
 */

/** Todas las plantillas. El orden es el que ve el operador en /settings. */
export const TEMPLATES: readonly LabelTemplate[] = [DEFAULT_TEMPLATE, PAPICAR_59X35];

export const DEFAULT_TEMPLATE_ID = DEFAULT_TEMPLATE.id;

/**
 * Devuelve la plantilla pedida, o la de 50 mm si el id no existe.
 *
 * Cae en la de 50 mm y no lanza a proposito: un `settings.json` con un id que ya no existe
 * (plantilla borrada, fichero editado a mano) tiene que seguir imprimiendo, no tumbar la
 * ruta de impresion entera.
 */
export function templateById(id: string | undefined | null): LabelTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? DEFAULT_TEMPLATE;
}
