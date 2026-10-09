import { LOGO_GF } from "./pa-picar-logo";
import { scaleGraphic } from "./gf-graphic";
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
  /**
   * Pasa el texto a mayusculas antes de medirlo y de imprimirlo.
   *
   * Va en la plantilla y no en `ascii.fold.ts` a proposito. Plegar a ASCII es una decision
   * GLOBAL y sin excepciones: la GK420t no tiene el glifo, y da igual que zona sea, porque
   * un acento suelto sale como un caracter que no es una letra. Mayusculas es una decision
   * de ASPECTO, y solo la toma una zona: el nombre del producto si, el precio no hace
   * falta, y el nombre del negocio en su propia zona si se quiere.
   *
   * Se aplica DESPUES de plegar, no antes. Al reves, `normalize("NFD")` separaria la tilde de
   * la letra, el plegado la borraria, y quedaria una `n` sin tilde en vez de una `N`. El
   * orden importa porque el plegado puede acortar la cadena, y medir la original y mandar
   * la plegada daria una anchura equivocada (`resolveAutoFit()`).
   *
   * No cambia la longitud, asi que no altera el `autoFit`: solo cambia los glifos, que en la
   * fuente de la impresora ocupan lo mismo en mayuscula que en minuscula.
   */
  uppercase?: boolean;
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
    /**
     * Alto TOTAL del bloque de texto, en dots, incluidas todas las lineas.
     *
     * Sin esto, `maxHeight` limita el alto de UNA linea pero no el alto que ocupa el texto
     * entero, y son cosas distintas en cuanto el texto se parte: `^FB` apila las lineas con
     * una separacion igual al alto de la fuente, asi que dos lineas de 32 dots ocupan 96, no
     * 64. Con el nombre empezando en y=72 y las barras en 168, un nombre de 65 caracteres
     * repartido en dos lineas a 32 dots llegaba a y=168, justo donde empiezan las barras.
     *
     * "Justo" es justo: dos cajas que se tocan no se solapan, y el detector de solapes no lo
     * marca. En el papel la linea de abajo del nombre y el primer filamento de las barras
     * quedan pegados, y eso no lo ve ningun test.
     *
     * Va en la zona y no en `resolveAutoFit()` porque es una medida del hueco que hay, y el
     * hueco lo decide quien coloca las zonas.
     *
     * El alto de un bloque de N lineas es `N * alto + (N - 1) * separacion`, y la separacion
     * es el alto de la fuente. Dos lineas de 32 dots ocupan 96, no 64. Esta cuenta la hace
     * `altoBloque()`, en `zpl.builder.ts`.
     */
    maxBlockDots?: number;
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
   * momento. En la plantilla de 50 x 25 mm (v1.2) esa fuente era la del precio (`^A0N,24`) y
   * la linea caia en y 168..192 mientras la referencia estaba en 186..198: 6 dots de solape.
   *
   * Decirlo a mano lo quita de juego, y la plantilla de 59 x 35 mm lo dice.
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
   * Sin esta lista, 261 de los 3080 productos del catalogo real (el 8,5%) saldrian con el
   * logo, el nombre y el precio arriba, y los 12,5 mm de abajo en blanco. Se decide aqui y
   * no en el constructor para que `buildZpl()` siga siendo un traductor de zonas a ZPL.
   *
   * PROVISIONAL: son cuatro coordenadas puestas a ojo, sin poder ver la etiqueta impresa.
   * Las revisa la fase Carro del editor de plantillas, que es donde el aspecto de la
   * etiqueta se resuelve de verdad.
   */
  zonesWithoutBarcode?: LabelZone[];
}

// ---------------------------------------------------------------------------------------
// Papicar 59 x 35 mm
// ---------------------------------------------------------------------------------------
//
// 472 x 280 dots a 203 dpi (8 dots/mm). Horizontal. Esta es la UNICA plantilla: la de
// 50 x 25 mm se borro en v1.3. Sigue en `git` en el tag `v1.2` por si hay que volver a ella.
//
// MEDIDA FISICA Y CONFIGURACION DE LA IMPRESORA
//
// Los dots de esta plantilla son el ancho de la ZONA IMPRESORA, no el del rollo. La GK420t
// tiene que tener el ancho de medio ajustado a 59 mm (o al rollo que se monte), porque si no
// el sensor de GAP se dispara con el ancho del rollo y el contenido sale corrido hacia un
// lado. `^PW472` por si solo no corrige eso: ^PW recorta, no posiciona. Hay que cambiar el
// medio en la impresora, no solo en el ZPL.
//
// LA SYMBOLOGIA NO SE DECIDE AQUI
//
// La decide `planBarcode()`, producto a producto, porque no todos los codigos del catalogo
// real de PA PICAR (3080 productos) son EAN-13 y forzar uno solo se salia del papel en 6 de
// cada 10 productos. Reparto real:
//
//   2250 productos  EAN-13  (^BE, 95 modulos fijos, el ancho no depende del dato)
//     1180 con 13 digitos y el control correcto
//     1064 UPC-A de 12 digitos, impresos con un 0 delante
//        (un UPC-A ES un EAN-13 con 0 delante: no es una convencion, sigue siendo valido)
//       6 con el digito de control mal, corregido al imprimir y avisado
//    569 productos  Code 128 (^BC, el ancho SI depende del dato)
//    261 productos  sin codigo: 256 no caben a 3 de modulo y 5 no traen codigo en origen
//
// POR QUE 3 DOTS DE MODULO Y NO 2
//
// El minimo de X en ISO/IEC 15420 es 0,264 mm. 3 dots son 0,375 mm, por encima. 2 dots
// son 0,250 mm, un 5% por debajo, y con el sangrado termico de un cabeza a 203 dpi las
// barras estrechas se cierran. A 2 de modulo caben 180 modulos en vez de 113, y con eso los
// 261 productos que hoy salen sin barras si tendrian, pero de los que se escanean en caja
// solo pasarian de 29 a 2 sin codigo. Se eligio respetar la norma: son 29 productos de
// RETAIL. Bajarlo a 2 es una decision de modulo, no de plantilla, y hay que probarla
// leyendo en fisico.
//
// LO QUE NO SE PUDO HACER Y POR QUE
//
// El ancho de barcode pedido son 20,5 mm. Es imposible con EAN-13, que es el 73 % del
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

// La etiqueta se describe en milimetros, UNA sola vez, y de ahi salen todos los dots.
//
// Antes cada consumidor de la medida volvia a escribir `dotsFromMm(59)`: el marco, el centrado del
// logo, y las dos propiedades de la plantilla. Tres sitios, el mismo numero, y nada que
// compruebe que siguen siendo el mismo. Cambiar el ancho de la etiqueta a mano era cambiar
// uno y olvidarse de los otros dos, y el que se olvidaba era el marco, que es justo el que no
// se puede equivocar.
//
// Hoy ademas cada zona tiene su geometria en mm: el logo, el nombre, el codigo (con su linea
// de interpretacion, que es la pieza `barcodeHumanText`), el REF y el precio. Nada de esto se
// escribe dos veces: se declara aqui en mm y las zonas quedan en dots via `dotsFromMm()`,
// que multiplica por `MM_TO_DOTS` (8 dots/mm a 203 dpi, la GK420t real). Si la etiqueta
// cambia de tamano, cambian estas constantes y las zonas lo siguen solas.
export const LABEL_WIDTH_MM = 59.0;
export const LABEL_HEIGHT_MM = 35.0;

// Logo: 27 x 9 mm (45,8 % del ancho, el "logo grande" que se pidio), centrado y a 5 mm del
// borde superior. El 16 sale de (59 - 27) / 2; escrito en mm para que seguir el centro del
// logo no dependa de acordarse de la resta.
const LOGO_W_MM = 27;
const LOGO_H_MM = 9;
const LOGO_X_MM = (LABEL_WIDTH_MM - LOGO_W_MM) / 2;
const LOGO_Y_MM = 5;

// Nombre: desde 15 mm (8 dots de aire bajo el logo, que acaba en 9 mm) con hasta 6 mm de
// letra. El bloque entero no pasa de 5 mm: a lo sumo llega a 15 + 5 = 20 mm y deja 1 mm de
// aire al codigo, que arranca en 21 mm.
//
// El minimo es 1,625 mm (13 dots) y NO 2 mm como en v1.8: con 2 mm, dos lineas ocupan
// 3 * 16 = 48 dots y el bloque maximo de 40 no se puede respetar, asi que el nombre largo
// caia en el caso 3 de `resolveAutoFit()` y se dibujaba tocando las barras. Con 13 dots,
// 3 * 13 = 39 <= 40, el bloque se respeta siempre y 68 caracteres (el maximo del catalogo)
// salen en UNA linea de 15 dots.
const NOMBRE_Y_MM = 15;
const NOMBRE_MAX_H_MM = 6;
const NOMBRE_MIN_H_MM = 1.625;
const NOMBRE_BLOQUE_MM = 5;

// Codigo de barras: 5 mm de x (la zona quieta de la izquierda es parte de la norma
// ISO/IEC 15420, no un adorno), 21 mm de y y 8,5 mm de barra (68 dots, por encima de los 8 mm
// que pide la legibilidad de mano).
//
// El 21 mm de y es un TECHO y no un gusto: el nombre, corto o largo, acaba a lo sumo en
// 20 mm (15 mm + bloque de 5 mm) y las barras necesitan 8 dots de aire (1 mm), que es una
// regla que ya atrapo una regresion real. Subir las barras por encima de 168 sin tocar el
// nombre no se puede: hay que elegir entre el bloque del nombre y el del codigo, y quien se
// queda con el sitio es el nombre.
//
// A MODULO 2 (0,250 mm de modulo, 190 dots = 23,75 mm de simbolo) y no a 3: lo decidio el
// usuario el 8/10 tras la prueba fisica del layout de dos columnas, que midio las barras
// "demasiado anchas y pegadas a REF". A modulo 2 el simbolo EAN-13 mide 190 dots y con las
// dos zonas quietas de 10X (2,5 mm a cada lado) la columna entera son 230 dots = 28,75 mm,
// 115 menos que con el modulo 3. Queda un 5 % por debajo del minimo de 0,264 mm de la
// norma, aceptado a cambio de que REF y PRICE respiren. Ver `COLUMNA_BARRAS_DOTS` en
// `zpl.builder.ts`.
export const BARCODE_X_MM = 5;
export const BARCODE_Y_MM = 21;
/** Ancho del AREA del codigo: simbolo a modulo 2 + las dos zonas quietas de 10X. */
export const BARCODE_WIDTH_MM = 28.75;
export const BARCODE_HEIGHT_MM = 8.5;

// Los numeros human-readable van en SU PROPIA ZONA, como texto, y no como la linea de
// interpretacion del `^BE`: la impresora coloca la linea del `^BY` con un hueco propio bajo
// las barras, que el ZPL no controla, y en la prueba fisica los numeros caian fuera de la
// etiqueta. Como zona de texto, la posicion la deciden estas dos constantes, el render mide
// exactamente lo que se imprime y nadie depende del firmware. 30,5 mm: 1 mm de aire sobre
// las barras (que acaban en 29,5) y 2 mm hasta el interior del marco (34 mm).
export const BARCODE_TEXT_X_MM = 5;
export const BARCODE_TEXT_Y_MM = 30.5;

// Precio y REF: columna derecha, alineados con la zona media/baja del codigo (21..32 mm) y
// con el pie en 28,75 mm. Los decimales son exactos a 8 dots/mm: 371 = 46,375 mm, 329 =
// 41,125 mm. El precio acaba en 459 dots (57,375 mm), 2 dots dentro del interior del marco,
// y el REF queda a la izquierda del precio, cerca, como salio en la prueba fisica.
export const PRICE_X_MM = 46.375;
export const PRICE_Y_MM = 23.75;
const PRICE_W_MM = 11;
export const PRICE_MAX_H_MM = 5;
export const PRICE_MIN_H_MM = 2.25;

export const REFERENCE_X_MM = 41.125;
export const REFERENCE_Y_MM = 26.25;
const REF_W_MM = 5;
const REF_H_MM = 2.5;

// Sin codigo de barras: el nombre arranca igual (15 mm) y el precio centrado queda a 22 mm,
// con la referencia a 30 mm.
const SIN_PRECIO_Y_MM = 22;
const SIN_REF_Y_MM = 30;
/**
 * Margen de seguridad por los cuatro lados, en dots.
 *
 * Son los que se pidieron para v1.8 y son distintos arriba que a los lados: 10 dots a izquierda
 * y derecha (1,25 mm) y 8 arriba y abajo (1 mm). No son redondos a proposito: el canto de una
 * etiqueta con solapa se come mas por los lados que por arriba y abajo, y a 1 mm por ese lado
 * el marco cae donde ya no hay papel.
 *
 * Los escribe el marco, que es quien los necesita, y de aqui salen las cajas de todo lo demas.
 */
const MARGEN_IZQ_DOTS = 10;
const MARGEN_DER_DOTS = 10;
const MARGEN_SUP_DOTS = 8;
const MARGEN_INF_DOTS = 8;
/** Radio de las esquinas del marco. 2 mm. */
const MM_RADIO = 2;
/** Las mismas medidas en dots, que es como trabaja todo lo demas. */
const ANCHO_DOTS = dotsFromMm(LABEL_WIDTH_MM);
const ALTO_DOTS = dotsFromMm(LABEL_HEIGHT_MM);

/**
 * El logo del layout actual: 216 x 72 dots (27 x 9 mm), reescalado del original de 200 x 67.
 *
 * Se reescala aqui, al cargar el modulo, y no en `/editor`, porque el layout del codigo tiene
 * que salir bien sin que nadie abra el editor. `scaleGraphic()` conserva la proporcion
 * (216/72 = 3,0 contra 200/67 = 2,985; la diferencia es el redondeo al byte) y ajusta el
 * ancho al multiplo de 8 mas cercano, que aqui ya es exacto (27 bytes).
 *
 * El 45,8 % del ancho sale de `LOGO_W_MM` y `LOGO_H_MM`, declarados arriba en mm con el resto
 * de la geometria; aqui solo se convierten a dots para reescalar el `^GFA`.
 *
 * Y NO se regenera `pa-picar-logo.ts`. El original se queda como esta: es el logo original, y
 * de el se derivan los demas tamanos. Reescribir el fichero por cada medida dejaria una sola
 * medida viva y `check-gf` dejaria de poder compararla con nada.
 */
const LOGO_V1_8 = scaleGraphic(LOGO_GF, dotsFromMm(LOGO_W_MM), dotsFromMm(LOGO_H_MM));
const LOGO_V1_8_GF = "gf" in LOGO_V1_8 ? LOGO_V1_8.gf : LOGO_GF;

// ---------------------------------------------------------------------------------------
// LAYOUT 2026-10: LOGO GRANDE ARRIBA, NOMBRE EN MAYUSCULAS, BARRAS IZQUIERDA Y PRECIO A LA
// DERECHA
// ---------------------------------------------------------------------------------------
//
// La prueba fisica del 7/10 midio el logo al 30-35 % y la spec nueva lo pide al 45-50 %, y
// las dos cosas no pueden ser las dos. Se eligio el "logo grande" (45,8 %) porque es lo que
// la spec pide. El barcode se bajo a MODULO 2 (0,250 mm) el 8/10, cuando la prueba fisica
// del layout de dos columnas mostro las barras a modulo 3 "demasiado anchas y pegadas a
// REF": a 3 dots el EAN-13 mide 285 dots (35,6 mm) y no deja columna derecha que valga. A
// 2 dots mide 190 (23,75 mm) y la columna de las barras queda en 230 dots. Ver
// `COLUMNA_BARRAS_DOTS` en `zpl.builder.ts`, y [[Prueba Legibilidad Barcode]].
//
// REPARTO VERTICAL (todo en mm arriba, en las constantes; aqui el resumen en mm):
//
//   y   5.. 14   logo, 27 x 9 mm (45,8 % del ancho), centrado
//   y  15..20    nombre, UNA linea si se puede, hasta 6 mm de letra, en mayusculas;
//                el bloque entero nunca pasa de 5 mm, asi que acaba a lo sumo en 20 mm
//                y deja 1 mm de aire al codigo.
//   y  21..29,5  barras, 68 dots = 8,5 mm
//   y  29,5..30,5 aire entre las barras y los numeros, 8 dots = 1 mm
//   y  30,5..32  "390000099999", los numeros human-readable COMO TEXTO PROPIO, 12 dots
//                (el bloque entero del codigo acaba en 32 mm, 2 mm por encima del
//                interior del marco de 34 mm y 3 mm del borde del papel)
//   y  23,75..28,75  precio, hasta 5 mm de alto, columna derecha (zona media/baja del codigo)
//   y  26,25..28,75  "REF:", 2,5 mm, al pie del numero (misma linea de base)
//   y  34        borde interior
//
// El logo y el nombre NO se tocan ni aunque el nombre crezca: el logo acaba en 14 mm y el
// nombre arranca en 15 mm. El nombre y el codigo tampoco: el bloque del nombre acaba a lo
// sumo en 20 mm (15 mm + 5 mm de bloque, sea cual sea la fuente que el `autoFit` elija) y
// las barras arrancan en 21 mm: 1 mm de aire. Ese aire es una regla vieja: sin el, un
// nombre de dos lineas llegaba hasta las barras y el detector de solapes no lo marcaba
// porque dos cajas que se tocan no se solapan.
//
// El ancho se parte en dos columnas: las barras a la izquierda (230 dots, el simbolo de 190
// a modulo 2 mas las dos zonas quietas de 10X) y el precio a la derecha (242 dots), a la
// altura de la zona media/baja del codigo. REF va a la izquierda del precio, chico y al pie,
// como salio en la prueba fisica.

export const DEFAULT_TEMPLATE: LabelTemplate = {
  id: "papicar-59x35",
  name: "Papicar 59 x 35 mm",
  widthMm: LABEL_WIDTH_MM,
  heightMm: LABEL_HEIGHT_MM,
  widthDots: ANCHO_DOTS,
  heightDots: ALTO_DOTS,
  zones: [
    // 1. Marco: 1,25 mm a los lados y 1 mm arriba y abajo, trazo de 1 dot, esquinas de 2 mm
    //    (16 dots). El rectangulo utilizable es 10,8 .. 462,272.
    //
    //    EL MARCO NO SE TOCA, Y POR ESO SE CALCULA.
    //
    //    Es el margen fisico de la etiqueta, y su valor es el que hace que la etiqueta salga
    //    bien. No es un elemento mas de los que se colocan: si el borde queda a 0,4 mm del
    //    canto del papel, la impresora puede cortarlo y la etiqueta sale con un lado comido, y
    //    eso no lo arregla ni el ZPL ni el editor.
    //
    //    Por eso sus medidas salen de `widthDots` y `heightDots`, los de la plantilla, y no
    //    de un 59 y un 35 escritos aqui. Escritos a mano, cambiar el ancho de la plantilla
    //    dejaba el marco en la medida de antes, pasando a 1 mm del canto o metido en el papel,
    //    sin que nada se quejara: el mismo fallo que hubo con `LOGO_DOTS_W`, que `check-gf`
    //    vigila, y aqui no habia nadie vigilando.
    //
    //    Y en `/editor` no se puede mover ni estirar (`EDITABLES` no lleva `"shape"`). Un tirador
    //    que se puede agarrar invita a moverlo, y esta es la unica zona que no se debe.
    {
      kind: "shape",
      x: MARGEN_IZQ_DOTS,
      y: MARGEN_SUP_DOTS,
      widthDots: ANCHO_DOTS - MARGEN_IZQ_DOTS - MARGEN_DER_DOTS,
      heightDots: ALTO_DOTS - MARGEN_SUP_DOTS - MARGEN_INF_DOTS,
      thicknessDots: 1,
      radiusDots: dotsFromMm(MM_RADIO),
    },
    // 2. Logo: 216 x 72 dots (27 x 9 mm, 45,8 % del ancho), centrado y a 5 mm del borde.
    //
    //    Es el 'logo grande' que se pidio: antes era 160 x 54 (33,9 %). El 45,8 % sale de
    //    `LOGO_W_MM` / `LOGO_H_MM`, que estan arriba con el resto de la geometria en mm.
    //
    //    Con la proporcion del logo (200:67 = 2,985), 27 x 9 mm son 216 x 72 dots: 216/72 = 3,0,
    //    la diferencia es el redondeo al byte de `scaleGraphic()`. Y deja sitio: el nombre
    //    arranca en 15 mm, 1 mm por debajo del logo.
    //
    //    El `^GFA` se reescala con `scaleGraphic()`, que conserva la proporcion y ajusta el
    //    ancho al multiplo de 8 MAS CERCANO. 216 ya es multiplo de 8 (27 bytes), asi que aqui
    //    no hay redondeo; esta comprobado en `check-gf`.
    //
    //    Para otro tamaño NO hay que regenerar `pa-picar-logo.ts`: en `/editor` se estira el
    //    logo con el asa de la derecha, `scaleGraphic()` reescribe el `^GFA` conservando la
    //    proporcion, y "Aplicar cambios" lo guarda entero.
    {
      kind: "graphic",
      x: dotsFromMm(LOGO_X_MM),
      y: dotsFromMm(LOGO_Y_MM),
      gf: LOGO_V1_8_GF,
    },
    // 3. Nombre: una sola linea cuando cabe, centrada, EN MAYUSCULAS, con la fuente mas grande
    //    que quepa sin salirse.
    //
    //    `uppercase: true` es una decision de esta zona y no un plegado global: la GK420t
    //    imprime el texto que le llega, y "BADIA JALAPENO 2 OZ" a 40 dots de alto se lee de
    //    lejos, mientras que a 24 dots no se lee ni de cerca. Ver `TextZone.uppercase`.
    //
    //    `maxWidthDots: 446` es todo el ancho util, de 13 a 459. Con `justify: "C"` el texto
    //    se centra en esa caja, asi que un nombre corto queda en el medio y uno largo llega
    //    hasta los bordes. "ocupar el 85-90 % del ancho" es lo que hace un nombre largo; un
    //    nombre corto no puede ocupar el 90 % sin estirar los glifos, y eso no se hace.
    //
    //    `widthRatio: 0,42` es condensada: el ancho del caracter es el 42 % de su alto. A 0,5
    //    el nombre de 42 caracteres del producto de prueba sale a 20 dots de alto, y a 0,42
    //    sale a 24. Los dos caben en 40 (5 mm de bloque); lo que cambia es cuanto se lee.
    {
      kind: "text",
      x: 13,
      y: dotsFromMm(NOMBRE_Y_MM),
      format: "^A0N,48,20",
      source: "productName",
      uppercase: true,
      // 446 y no 452: la caja del `^FB` llega a los bordes del area util y el marco esta en
      // 10, asi que el texto acabaria pegado al borde, con el trazo de 1 dot encima. Con 3 dots
      // de aire a cada lado la caja queda en 13..459, dentro del interior del marco (11..461).
      //
      // `maxLines: 2` y no 1, a proposito. Con UNA sola linea, el nombre mas largo del
      // catalogo (68 caracteres) pide mas de 446 dots a la fuente mas pequena permitida, y
      // `^FB` recortaria el final en el papel. Con dos lineas, `resolveAutoFit()` encuentra un
      // alto menor que quepa entero.
      //
      // Con el layout nuevo casi nunca se usa: 68 caracteres caben en UNA linea de 15 dots
      // (68 * 6 = 408 <= 446), asi que el paso 1 se lleva la victoria. La segunda linea queda
      // para el nombre que no cabe ni a 13 dots en una linea (mas de 89 caracteres), que en el
      // catalogo no existe hoy, y para el editor, donde el usuario puede estrechar la caja.
      maxWidthDots: 446,
      maxLines: 2,
      justify: "C",
      // 40 dots de bloque (5 mm): el nombre arranca en 15 mm (120 dots), las barras en 21 mm
      // (168), y entre medias quedan 48 dots. Se dejan 8 de aire para que la ultima linea no
      // quede pegada a las barras, que es un contacto que el detector de solapes NO marca (dos
      // cajas que se tocan no se solapan) y que en el papel se ve como un nombre arrimado al
      // codigo.
      //
      // El suelo es 13 dots (1,625 mm) y NO 16 (2 mm) por esto: con 16, dos lineas ocupan
      // 3 * 16 = 48 dots y el bloque de 40 no se puede respetar, asi que el nombre largo caia
      // al caso 3 de `resolveAutoFit()` y se dibujaba tocando las barras. Con 13, 3 * 13 = 39
      // y el bloque se cumple siempre, en una o en dos lineas.
      autoFit: {
        maxHeight: dotsFromMm(NOMBRE_MAX_H_MM),
        minHeight: dotsFromMm(NOMBRE_MIN_H_MM),
        widthRatio: 0.42,
        maxBlockDots: dotsFromMm(NOMBRE_BLOQUE_MM),
      },
    },
    // 4. Codigo de barras: mitad IZQUIERDA INFERIOR, 68 dots de alto (8,5 mm), SIN linea de
    //    interpretacion: los numeros van como zona de texto aparte, debajo, en su propia
    //    posicion. Ver la zona 5.
    //
    //    `center: false` y `x: 40` (5 mm). La `x` es donde empieza el SIMBOLO, y va a 40 y no
    //    a 10 porque los 20 dots de zona quieta de la izquierda que pide la norma a modulo 2
    //    (10X = 20 dots, mas aire) son parte de ISO/IEC 15420, no un adorno: si el simbolo
    //    tocara el marco, el lector tendria el borde del papel en el margen que la norma
    //    exige. El simbolo acaba en 230, y desde ahi hasta REF (329) hay 99 dots: la quiet
    //    zone derecha entera (20 dots) y la columna de REF/PRICE respirando.
    //
    //    `moduleWidth: 2` son 0,250 mm de barra: la decision del 8/10, tras la prueba fisica
    //    que midio las barras a modulo 3 "demasiado anchas y pegadas a REF". A 3 dots el
    //    simbolo media 285 (35,6 mm) y la columna derecha no respiraba; a 2 mide 190 (23,75
    //    mm) y REF/PRICE tienen sitio. Queda un 5 % por debajo del minimo de 0,264 mm de
    //    ISO/IEC 15420, aceptado. Ver `COLUMNA_BARRAS_DOTS` en `zpl.builder.ts` y [[Prueba
    //    Legibilidad Barcode]].
    {
      kind: "barcode",
      x: dotsFromMm(BARCODE_X_MM),
      y: dotsFromMm(BARCODE_Y_MM),
      heightDots: dotsFromMm(BARCODE_HEIGHT_MM),
      interpretationLine: false,
      source: "barcode",
      center: false,
      moduleWidth: 2,
    },
    // 5. Los numeros human-readable (el `barcodeHumanText` de la spec) como TEXTO PROPIO:
    //    la propia impresora los dibujaba con un hueco que el ZPL no controla y caian fuera
    //    de la etiqueta; como zona de texto, `BARCODE_TEXT_Y_MM` manda y el render mide lo
    //    mismo que se imprime.
    //
    //    `source: "barcodeData"` saca `plan.data`, que ya lleva el 0 delante de los UPC-A y
    //    el digito de control corregido, asi que no puede desincronizarse del simbolo.
    //
    //    12 dots de alto, celda de 7: la misma proporcion que dibujaba el `^BY` del firmware.
    //    La `x` es la del simbolo (5 mm) y la `y` 30,5 mm: 1 mm de aire sobre las barras
    //    (que acaban en 29,5 mm) y 2 mm hasta el interior del marco (34 mm). Nunca se corta.
    {
      kind: "text",
      x: dotsFromMm(BARCODE_TEXT_X_MM),
      y: dotsFromMm(BARCODE_TEXT_Y_MM),
      format: "^A0N,12,7",
      source: "barcodeData",
      // La caja llega hasta la quiet zone derecha del simbolo (230 dots), asi el texto no
      // puede invadir la columna de REF/PRICE ni siquiera con un codigo de 13 digitos a
      // 7 dots de celda (91 dots).
      maxWidthDots: dotsFromMm(BARCODE_WIDTH_MM),
      maxLines: 1,
      justify: "L",
    },
    // 6. Precio y referencia, columna DERECHA, alineados con la zona media/baja del codigo.
    //
    //    "REF:" a 20 dots y el numero a 40, con la PIE de la palabra a la altura de la del
    //    numero: el precio acaba en 230 y el REF tambien (26,25 + 2,5 = 28,75 mm), que es la
    //    misma linea de base. Asi se leen como "REF: 3.00" y no como dos textos sueltos, y
    //    quedan en la zona media/baja del codigo como salio en la prueba fisica (las barras
    //    van de 19 a 28 mm y esto cubre de 23,75 a 28,75).
    //
    //    Los dos con `justify: "R"` y acabando en 459 (el margen derecho, con 2 dots de aire
    //    al interior del marco). Un precio de "1234.56" ocupa 7 caracteres y uno de "3.00"
    //    ocupa 5 con el "$": con la `x` fijada a la izquierda, el numero corto pegaria al
    //    centro de su caja en vez de a la derecha, y "REF:" y el precio se separarian al
    //    variar el precio.
    //
    //    El precio lleva `autoFit` porque con el ancho de columna que queda no caben todos:
    //    a 40 dots un "1234.56" mide 136 dots y la columna son 88. `autoFit` lo baja hasta que
    //    quepa, con un suelo de 18 dots (2,25 mm), por debajo del cual ya no se lee de lejos.
    {
      kind: "text",
      x: dotsFromMm(REFERENCE_X_MM),
      y: dotsFromMm(REFERENCE_Y_MM),
      format: "^A0N,20,10",
      source: "referenceLabel",
      // La caja va de 329 a 369, y el precio de 371 a 459. Tres cosas tienen que cuadrar aqui y
      // las tres se comprobaron con el detector de solapes, no a ojo:
      //
      //   - "REF:" a 10 dots de celda son 40, y la caja mide 40. Con la caja mas estrecha que
      //     el texto, el render lo dibujaba de 316 a 356 y la caja llegaba a 360: dos avisos
      //     falsos, un MARCO y un CHOQUE contra el precio. La caja mide lo que mide el texto.
      //   - El 329 (41,125 mm) es porque las barras acaban en 230 (23,75 mm) y a partir de
      //     ahi la quiet zone derecha (20 dots) deja el sitio libre hasta 250. Con x en 316
      //     la palabra se metia debajo de ellas: `"REF:" pisa a "barras"`, que es
      //     cierto.
      //   - El 371 (46,375 mm) es porque el precio necesita 85 dots para "$3.00" a 17 de
      //     celda, y con la caja en 363 el texto se dibujaba desde 374 y las cajas se tocaban.
      maxWidthDots: dotsFromMm(REF_W_MM),
      maxLines: 1,
      justify: "R",
    },
    {
      kind: "text",
      x: dotsFromMm(PRICE_X_MM),
      // 23,75 mm: la zona media/baja de las barras (19..28), no arriba como antes. Con el
      // logo grande, el precio subido a 21 mm quedaba visualmente colgado entre el nombre y el
      // codigo; en la prueba fisica salio mas abajo, en la zona del codigo.
      y: dotsFromMm(PRICE_Y_MM),
      format: "^A0N,40,17",
      source: "price",
      // El "$" va aqui y no dentro de `LabelData` porque es una decision de la plantilla, no
      // del producto. La plantilla de 50 x 25 mm tambien lo llevaba y asi sigue en el
      // mostrador: quitarlo seria un cambio de aspecto que nadie ha pedido.
      prefix: "$",
      // 88 y no 96: la caja acaba en 459 (57,375 mm), dos dots por dentro del interior del
      // marco (461), y a 363 se solapaba con la de "REF:".
      maxWidthDots: dotsFromMm(PRICE_W_MM),
      maxLines: 1,
      justify: "R",
      autoFit: {
        maxHeight: dotsFromMm(PRICE_MAX_H_MM),
        minHeight: dotsFromMm(PRICE_MIN_H_MM),
        widthRatio: 0.42,
      },
    },
  ],

  /**
   * Sin codigo de barras: los productos cuyo simbolo no cabe o que no traen codigo en origen.
   *
   * Recomponer la etiqueta entera, no dejar un hueco: la mitad izquierda se quedaria en blanco
   * y eso parece una etiqueta rota. Con 35 mm hay alto de sobra para bajar el nombre y aun asi
   * poner el precio grande, que es lo que se lee de lejos.
   *
   * El logo y el nombre van IGUAL que en la etiqueta con barras, para que la fila del lineal
   * se lea pareja: el mismo logo, el mismo sitio y las mismas mayusculas. Lo que cambia es que
   * el nombre puede ocupar mas lineas (hasta 2, en vez de preferir siempre 1) porque no hay
   * nada debajo, y el precio se pone CENTRADO y en grande, en vez de en la columna derecha.
   */
  zonesWithoutBarcode: [
    {
      kind: "shape",
      x: MARGEN_IZQ_DOTS,
      y: MARGEN_SUP_DOTS,
      widthDots: ANCHO_DOTS - MARGEN_IZQ_DOTS - MARGEN_DER_DOTS,
      heightDots: ALTO_DOTS - MARGEN_SUP_DOTS - MARGEN_INF_DOTS,
      thicknessDots: 1,
      radiusDots: dotsFromMm(MM_RADIO),
    },
    {
      kind: "graphic",
      x: dotsFromMm(LOGO_X_MM),
      y: dotsFromMm(LOGO_Y_MM),
      gf: LOGO_V1_8_GF,
    },
    // UNA sola linea siempre que quepa, como en la etiqueta con barras. Aqui habria sitio
    // para mas, pero partir el nombre en dos lo hace mas lento de leer de un vistazo, y sin
    // barras la etiqueta ya no es identica a la de al lado: anadirle la unica diferencia de
    // mas complica mas de lo que ayuda.
    //
    // El techo es el mismo bloque de la etiqueta con barras: el nombre arranca en 15 mm
    // (120 dots), el precio centrado en 22 mm (176), y entre medias quedan 56 dots. Se
    // dejan 8 de aire y el bloque queda en 48, que con `maxLines: 2` da dos lineas de 16
    // dots como techo. No hace falta usarlo: nombres de 50 caracteres caben en una linea
    // de 21, y el maximo del catalogo (68) en una de 15 (68 * 6 = 408, caja de 452).
    {
      kind: "text",
      x: MARGEN_IZQ_DOTS,
      y: dotsFromMm(NOMBRE_Y_MM),
      format: "^A0N,48,20",
      source: "productName",
      uppercase: true,
      maxWidthDots: ANCHO_DOTS - MARGEN_IZQ_DOTS - MARGEN_DER_DOTS,
      maxLines: 2,
      justify: "C",
      autoFit: {
        maxHeight: dotsFromMm(NOMBRE_MAX_H_MM),
        minHeight: dotsFromMm(NOMBRE_MIN_H_MM),
        widthRatio: 0.42,
        // 48 y no mas: el precio esta en 176 y el bloque no puede pasar de 168, con los
        // mismos 8 dots de aire que en la etiqueta con barras.
        maxBlockDots: dotsFromMm(NOMBRE_BLOQUE_MM) + 8,
      },
    },
    {
      kind: "text",
      x: MARGEN_IZQ_DOTS,
      y: dotsFromMm(SIN_PRECIO_Y_MM),
      format: "^A0N,52,22",
      source: "price",
      prefix: "$",
      maxWidthDots: ANCHO_DOTS - MARGEN_IZQ_DOTS - MARGEN_DER_DOTS,
      maxLines: 1,
      justify: "C",
      autoFit: { maxHeight: 52, minHeight: 20, widthRatio: 0.42 },
    },
    {
      kind: "text",
      x: MARGEN_IZQ_DOTS,
      y: dotsFromMm(SIN_REF_Y_MM),
      format: "^A0N,16,8",
      source: "reference",
      prefix: "REF: ",
      // El precio acaba en 228 (22 + 6,5 mm) y la referencia empieza en 240 (30 mm): 12 dots
      // de aire. Con la referencia en 256 se salia por abajo del marco (el interior acaba en
      // 271 y el texto llegaba a 272), y con el precio en 208 las dos cajas se pisaban.
      maxWidthDots: ANCHO_DOTS - MARGEN_IZQ_DOTS - MARGEN_DER_DOTS,
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

/**
 * Todas las plantillas. El orden es el que ve el operador en /settings.
 *
 * Solo hay una desde v1.3. Se mantiene el array y no una constante suelta para que volver a
 * anadir una segunda plantilla sea solo meterla aqui, sin tocar `templateById()` ni la pagina
 * de ajustes.
 */
export const TEMPLATES: readonly LabelTemplate[] = [DEFAULT_TEMPLATE];

export const DEFAULT_TEMPLATE_ID = DEFAULT_TEMPLATE.id;

/**
 * Devuelve la plantilla pedida, o la de 59 x 35 si el id no existe.
 *
 * Cae en la de 59 x 35 y no lanza a proposito: un `settings.json` con el id de la plantilla
 * que se borro en v1.3 (`papicar-50x25`) tiene que seguir imprimiendo, no tumbar la ruta de
 * impresion entera. Es justo el caso que se va a dar en cuanto se actualice.
 */
export function templateById(id: string | undefined | null): LabelTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? DEFAULT_TEMPLATE;
}
