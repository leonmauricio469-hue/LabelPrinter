import { LOGO_DOTS_W, LOGO_GF } from "./pa-picar-logo";
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

// Medidas de la etiqueta, en un sitio solo.
//
// Antes cada consumidor de la medida volvia a escribir `dotsFromMm(59)`: el marco, el centrado del
// logo, y las dos propiedades de la plantilla. Tres sitios, el mismo numero, y nada que
// compruebe que siguen siendo el mismo. Cambiar el ancho de la etiqueta a mano era cambiar
// uno y olvidarse de los otros dos, y el que se olvidaba era el marco, que es justo el que no
// se puede equivocar.
const MM_ANCHO = 59;
const MM_ALTO = 35;
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
const ANCHO_DOTS = dotsFromMm(MM_ANCHO);
const ALTO_DOTS = dotsFromMm(MM_ALTO);

/**
 * El logo del layout v1.8: 160 x 54 dots, reescalado del original de 200 x 67.
 *
 * Se reescala aqui, al cargar el modulo, y no en `/editor`, porque el layout del codigo tiene
 * que salir bien sin que nadie abra el editor. `scaleGraphic()` conserva la proporcion
 * (160/54 = 2,963 contra 200/67 = 2,985; la diferencia es el redondeo al byte) y ajusta el
 * ancho al multiplo de 8 mas cercano, que aqui ya es exacto.
 *
 * Y NO se regenera `pa-picar-logo.ts`. El original se queda como esta: es el logo original, y
 * de el se derivan los demas tamanos. Reescribir el fichero por cada medida dejaria una sola
 * medida viva y `check-gf` dejaria de poder compararla con nada.
 */
const LOGO_V1_8 = scaleGraphic(LOGO_GF, 160, 54);
const LOGO_V1_8_GF = "gf" in LOGO_V1_8 ? LOGO_V1_8.gf : LOGO_GF;
const LOGO_V1_8_W = "dots" in LOGO_V1_8 ? LOGO_V1_8.dots.w : LOGO_DOTS_W;

// ---------------------------------------------------------------------------------------
// LAYOUT v1.8: LOGO ARRIBA, NOMBRE EN MAYUSCULAS, BARRAS IZQUIERDA Y PRECIO A LA DERECHA
// ---------------------------------------------------------------------------------------
//
// Antes las barras iban centradas y ocupaban todo el ancho, con el precio debajo. Ahora el
// ancho se parte en dos columnas: las barras a la izquierda y el precio a la derecha, a la
// altura de las barras. El reparto y el porqué de 345 dots estan en `zpl.builder.ts`
// (`COLUMNA_BARRAS_DOTS`), que es donde vive la decision de verdad.
//
// REPARTO VERTICAL, con el logo a 54 dots de alto y las barras a 75:
//
//   y  10.. 64   logo, 160 x 54 dots (20,0 x 6,8 mm), centrado
//   y  72..128   nombre, UNA linea, hasta 56 dots de alto, en mayusculas
//   y 168..243   barras, 75 dots = 9,4 mm
//   y 243..255   linea de interpretacion, 12 dots
//   y 168..208   "3.00", 40 dots de alto, columna derecha
//   y 188..208   "REF:", 20 dots, al pie del numero (misma linea de base)
//   y 272        borde interior
//
// El logo y el nombre NO se tocan ni aunque el nombre se haga mas grande: el techo del nombre
// son 56 dots y acaba en 128, y el logo acaba en 64. Quedan 8 dots de aire entre los dos con
// el nombre a su maximo, y 40 con un nombre corto. Ese hueco es el que hace que el nombre se
// pueda agrandar sin tocar el logo, que es lo que se pidio.

export const DEFAULT_TEMPLATE: LabelTemplate = {
  id: "papicar-59x35",
  name: "Papicar 59 x 35 mm",
  widthMm: MM_ANCHO,
  heightMm: MM_ALTO,
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
    // 2. Logo: 160 x 54 dots, centrado. Es mas pequeno que el de antes (200 x 67) a proposito.
    //
    //    Se pidio "55-65 % del ancho" y "45-55 dots de alto" a la vez, y con el logo de
    //    proporcion 200:67 (2,985) esas dos cosas no pueden ser las dos: 55 % del ancho son
    //    260 dots, que son 87 de alto, y 45-55 de alto son 134-164 de ancho, que es 28-35 %.
    //    Elegido el alto, porque lo que se lee de lejos en un lineal es el nombre, y un logo
    //    de 103 dots de alto deja 130 dots para todo lo demas.
    //
    //    El `^GFA` se reescala con `scaleGraphic()`, que conserva la proporcion y ajusta el
    //    ancho al multiplo de 8 MAS CERCANO. 160 ya es multiplo de 8, asi que aqui no hay
    //    redondeo; esta comprobada en `check-gf`.
    //
    //    Para otro tamaño NO hay que regenerar `pa-picar-logo.ts`: en `/editor` se estira el
    //    logo con el asa de la derecha, `scaleGraphic()` reescribe el `^GFA` conservando la
    //    proporcion, y "Aplicar cambios" lo guarda entero.
    {
      kind: "graphic",
      x: Math.round((ANCHO_DOTS - LOGO_V1_8_W) / 2),
      y: 10,
      gf: LOGO_V1_8_GF,
    },
    // 3. Nombre: una sola linea, centrada, EN MAYUSCULAS, con la fuente mas grande que quepa
    //    sin salirse.
    //
    //    `uppercase: true` es una decision de esta zona y no un plegado global: la GK420t
    //    imprime el texto que le llega, y "BADIA JALAPENO 2 OZ" a 56 dots de alto se lee de
    //    lejos, mientras que a 24 dots no se lee ni de cerca. Ver `TextZone.uppercase`.
    //
    //    `maxWidthDots: 452` es todo el ancho util, de 10 a 462. Con `justify: "C"` el texto
    //    se centra en esa caja, asi que un nombre corto queda en el medio y uno largo llega
    //    hasta los bordes. "ocupar el 85-90 % del ancho" es lo que hace un nombre largo; un
    //    nombre corto no puede ocupar el 90 % sin estirar los glifos, y eso no se hace.
    //
    //    `widthRatio: 0,42` es condensada: el ancho del caracter es el 42 % de su alto. A 0,5
    //    el nombre de 40 caracteres del producto de prueba sale a 23 dots de alto, y a 0,42
    //    sale a 28. Los dos caben en 56; lo que cambia es cuanto se lee.
    {
      kind: "text",
      x: 13,
      y: 72,
      format: "^A0N,56,24",
      source: "productName",
      uppercase: true,
      // 446 y no 452: la caja del `^FB` llega a los bordes del area util y el marco esta en
      // 10, asi que el texto acabaria pegado al borde, con el trazo de 1 dot encima. Con 3 dots
      // de aire a cada lado la caja queda en 13..459, dentro del interior del marco (11..461).
      //
      // `maxLines: 2` y no 1. Con una sola linea, el nombre mas largo del catalogo (68
      // caracteres) necesita 476 dots a la fuente mas pequena y se salen 30 dots de la caja;
      // en el papel, `^FB` los recorta y el nombre pierde el final. Con dos lineas, ese mismo
      // nombre sale a 26 dots de alto repartido en dos, y se lee entero. `resolveAutoFit()`
      // sigue preferring una linea siempre que quepa, asi que esto solo se usa cuando de
      // verdad no cabe, que son 4 productos de 3080.
      maxWidthDots: 446,
      maxLines: 2,
      justify: "C",
      // 88 dots de bloque: el nombre arranca en 72, las barras en 168, y entre medias quedan
      // 96. Se dejan 8 de aire para que la ultima linea no quede pegada a las barras, que es
      // un contacto que el detector de solapes NO marca (dos cajas que se tocan no se solapan)
      // y que en el papel se ve como un nombre arrimado al codigo.
      autoFit: { maxHeight: 56, minHeight: 16, widthRatio: 0.42, maxBlockDots: 88 },
    },
    // 4. Codigo de barras: mitad IZQUIERDA INFERIOR, 75 dots de alto (9,4 mm), con la linea de
    //    interpretacion debajo a 12 dots (dicho a mano: si no, ^BY la pone a la altura de la
    //    fuente vigente y se come al precio).
    //
    //    `center: false` y `x: 40`. La `x` es donde empieza el SIMBOLO, y va a 40 y no a 10
    //    porque los 30 dots de zona quieta de la izquierda (10X a modulo 3) son parte de la
    //    norma, no un adorno: si el simbolo tocara el marco, el lector tendria el borde del
    //    papel en el margen que la norma exige. El simbolo acaba en 325, y desde ahi hasta el
    //    precio hay 30 dots de zona quieta a la derecha mas un poco de aire.
    //
    //    El numero de abajo lo dibuja la propia impresora desde `plan.data`, que ya lleva
    //    el 0 delante de los UPC-A y el digito de control corregido, asi que no puede
    //    desincronizarse del simbolo.
    //
    //    `moduleWidth: 3` son 0,375 mm de barra, por encima del minimo de 0,264 mm de
    //    ISO/IEC 15420. A 2 dots el simbolo seria de 190 y dejaria 127 dots mas para el
    //    precio, pero 0,250 mm queda por debajo de la norma y el lector puede rechazarla.
    //    Ver `COLUMNA_BARRAS_DOTS` en `zpl.builder.ts` y [[Prueba Legibilidad Barcode]].
    {
      kind: "barcode",
      x: 40,
      y: 168,
      heightDots: 75,
      interpretationLine: true,
      source: "barcode",
      center: false,
      moduleWidth: 3,
      hriHeightDots: 12,
    },
    // 5. Precio y referencia, columna DERECHA, alineados con las barras.
    //
    //    "REF:" a 20 dots y el numero a 40, con la PIE de la palabra a la altura de la del
    //    numero: los dos acaban en 208, que es la misma linea de base. Asi se leen como
    //    "REF: 3.00" y no como dos textos sueltos.
    //
    //    Los dos con `justify: "R"` y acabando en 462 (el margen derecho). Un precio de
    //    "1234.56" ocupa 7 caracteres y uno de "3.00" ocupa 5 con el "$": con la `x` fijada a
    //    la izquierda, el numero corto pegaria al centro de su caja en vez de a la derecha, y
    //    "REF:" y el precio se separarian al variar el precio.
    //
    //    El precio lleva `autoFit` porque con el ancho de columna que queda no caben todos:
    //    a 40 dots un "1234.56" mide 140 dots y la columna son 99. `autoFit` lo baja hasta que
    //    quepa, con un suelo de 18 dots (2,25 mm), por debajo del cual ya no se lee de lejos.
    {
      kind: "text",
      x: 329,
      y: 188,
      format: "^A0N,20,10",
      source: "referenceLabel",
      // La caja va de 329 a 369, y el precio de 371 a 459. Tres cosas tienen que cuadrar aqui y
      // las tres se comprobaron con el detector de solapes, no a ojo:
      //
      //   - "REF:" a 10 dots de celda son 40, y la caja mide 40. Con la caja mas estrecha que
      //     el texto, el render lo dibujaba de 316 a 356 y la caja llegaba a 360: dos avisos
      //     falsos, un MARCO y un CHOQUE contra el precio. La caja mide lo que mide el texto.
      //   - El 329 es porque las barras acaban en 325 y hay que empezar despues. Con x en 316
      //     la palabra se metia debajo de ellas: `"REF:" pisa a "barras"`, que es cierto.
      //   - El 371 es porque el precio necesita 85 dots para "$3.00" a 17 de celda, y con la
      //     caja en 363 el texto se dibujaba desde 374 y las cajas se tocaban.
      maxWidthDots: 40,
      maxLines: 1,
      justify: "R",
    },
    {
      kind: "text",
      x: 371,
      y: 168,
      format: "^A0N,40,17",
      source: "price",
      // El "$" va aqui y no dentro de `LabelData` porque es una decision de la plantilla, no
      // del producto. La plantilla de 50 x 25 mm tambien lo llevaba y asi sigue en el
      // mostrador: quitarlo seria un cambio de aspecto que nadie ha pedido.
      prefix: "$",
      // 88 y no 96: la caja acaba en 459, dos dots por dentro del interior del marco (461),
      // y a 363 se solapaba con la de "REF:".
      maxWidthDots: 88,
      maxLines: 1,
      justify: "R",
      autoFit: { maxHeight: 40, minHeight: 18, widthRatio: 0.42 },
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
   * el nombre puede ocupar mas lineas (hasta 3, en vez de 1) porque no hay nada debajo, y el
   * precio se pone CENTRADO y en grande, en vez de en la columna derecha.
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
      x: Math.round((ANCHO_DOTS - LOGO_V1_8_W) / 2),
      y: 10,
      gf: LOGO_V1_8_GF,
    },
    // UNA sola linea, como en la etiqueta con barras. Aqui habria sitio para mas, pero
    // partir el nombre en dos lo hace mas lento de leer de un vistazo, y sin barras la
    // etiqueta ya no es identica a la de al lado: anadirle la unica diferencia de mas
    // complica mas de lo que ayuda.
    //
    // El techo baja de 56 a 40 porque el precio centrado de abajo arranca en 208 y 3 lineas
    // de 56 dots se comian el sitio. Con `autoFit` el nombre largo nunca llega a 40: el
    // nombre de 50 caracteres del catalogo sale a 21 dots. El 40 es para nombres de 20-25.
    {
      kind: "text",
      x: MARGEN_IZQ_DOTS,
      y: 72,
      format: "^A0N,40,17",
      source: "productName",
      uppercase: true,
      maxWidthDots: ANCHO_DOTS - MARGEN_IZQ_DOTS - MARGEN_DER_DOTS,
      maxLines: 2,
      justify: "C",
      // Aqui hay 104 dots entre el nombre (72) y el precio (176), y se dejan 8 de aire.
      // Con 96 de bloque caben dos lineas de 48, de modo que un nombre largo sale en dos
      // lineas grandes en vez de en una linea de 20 dots que no se lee de lejos.
      autoFit: { maxHeight: 48, minHeight: 16, widthRatio: 0.42, maxBlockDots: 96 },
    },
    {
      kind: "text",
      x: MARGEN_IZQ_DOTS,
      y: 176,
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
      y: 240,
      format: "^A0N,16,8",
      source: "reference",
      prefix: "REF: ",
      // El precio acaba en 228 y la referencia empieza en 240: 12 dots de aire. Con la
      // referencia en 256 se salia por abajo del marco (el interior acaba en 271 y el texto
      // llegaba a 272), y con el precio en 208 las dos cajas se pisaban.
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
