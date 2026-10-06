/**
 * Redimensionado de zonas de etiqueta arrastrando.
 *
 * POR QUE ESTA FUERA DE LA PANTALLA
 *
 * Es geometria pura: dada una zona, un asa y quantos dots se ha movido el puntero, devuelve la
 * zona nueva. No necesita React, ni el DOM, ni una peticion al servidor. Por eso va aqui y se
 * puede probar con una tabla de numeros, en vez de quedar escondido en un manejador de
 * `mousemove` donde un error solo se ve moviendo el raton a ojo.
 *
 * Ademas, el servidor vuelve a renderizar y a comprobar solapes antes de guardar, asi que un
 * error aqui no llega al papel: llega a la pantalla, donde se ve enseguida.
 *
 * QUE SIGNIFICA "REDIMENSIONAR" EN CADA TIPO DE ZONA
 *
 * No es lo mismo, y fingir que si seria mentir sobre lo que se puede cambiar:
 *
 *   `shape`    el rectangulo es la zona. Las cuatro aristas van a `widthDots`/`heightDots`.
 *   `graphic`  las aristas reescalan el bitmap del `^GFA`. Se guarda LA PROPORCION: un logo
 *              estirado queda mal y nadie lo quiere asi. El ancho se ajusta al multiplo de 8
 *              que le toca, porque el formato no admite otros.
 *   `text`     las aristas verticales cambian el ALTO DE LETRA (con `autoFit`, el techo).
 *              Las horizontales cambian el ancho de la caja `^FB`, que es lo que decide por
 *              donde se parte el texto.
 *   `barcode`  las aristas verticales cambian la altura de las barras. Las horizontales NO
 *              mueven el simbolo: un EAN-13 mide 95 modulos y ese numero no se negocia, lo que
 *              se negocia es el ancho de cada modulo. Ademas, con `center` la `x` de la zona no
 *              manda: el simbolo se centra solo, asi que arrastrarlo de lado no haria nada.
 *
 * ESTO NO ES UN DIBUJO: NO SE ESTIRA EL CONTENIDO
 *
 * Un texto no se deforma al ensanchar su caja, se repararte en mas lineas. Un codigo de barras
 * no se estira, cambia de grosor de modulo. Aqui solo se cambia el DATO de la zona; quien
 * decide como queda de verdad es `buildZpl()`, que es el mismo que va a la impresora.
 */

import { scaleGraphic, graphicDots } from "./gf-graphic";
import type { LabelZone } from "./label.template";

/** Las ocho asas de una caja. */
export const ASIDERES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
export type Asider = (typeof ASIDERES)[number];

/** Que texto va pegado a cada asa, para el `title` que sale al pasar el raton. */
export const TITULO_ASIDERA: Record<Asider, string> = {
  nw: "arrastrar esquina arriba-izquierda",
  n: "arrastrar borde arriba",
  ne: "arrastrar esquina arriba-derecha",
  e: "arrastrar borde derecho",
  se: "arrastrar esquina abajo-derecha",
  s: "arrastrar borde abajo",
  sw: "arrastrar esquina abajo-izquierda",
  w: "arrastrar borde izquierdo",
};

/**
 * Medidas minimas, en dots. Por debajo de esto ya no es un elemento, es un error.
 *
 * Exportadas porque el marco de seleccion (`label.marco.ts`) tiene que recortar el arrastre con
 * EXACTAMENTE los mismos numeros que `redimensionar()`: si cada uno tuviera su propio minimo,
 * el marco podria estirarse hasta 6 dots y la zona quedarse en 8, y al soltar el marco saltaria
 * sin que nadie hubiera hecho nada para merecerlo.
 */
export const MIN_DOTS = {
  ancho: 8,
  alto: 4,
  altoBarra: 10,
} as const;

/** Lo que hay que saber de la zona que ademas no esta en la zona. */
export interface ContextoResize {
  /**
   * Modulos del simbolo actual.
   *
   * Sin esto no se puede pasar de "arrastrar 3 dots a la derecha" a "`moduleWidth` 4", porque
   * el ancho del simbolo es `modulos * moduleWidth` y hay que dividir por los modulos para
   * saber cuanto vale un modulo. Lo aporta el servidor, que ya lo sabe al elegir la
   * symbologia.
   */
  modulos: number;

  /**
   * Ancho en dots de la caja de texto que dibuja el servidor, en el nombre de prueba actual.
   *
   * Solo se usa cuando la zona NO tiene `maxWidthDots`. Sin ese campo, `emit()` no escribe
   * `^FB` y la caja no existe como dato: su ancho es el que ocupa el texto, que cambia con
   * cada producto. Asi que para partir de algo hay que usar la medida del render, no un
   * supuesto. Si tampoco viene, no hay ancho de base y el eje horizontal se aparta.
   */
  anchoCajaTexto?: number;
}

/** Cual de los cuatro lados se mueve con cada asa. Compartido con `label.marco.ts`. */
export function lados(a: Asider): { izq: boolean; arr: boolean; der: boolean; aba: boolean } {
  return {
    izq: a === "w" || a === "nw" || a === "sw",
    arr: a === "n" || a === "nw" || a === "ne",
    der: a === "e" || a === "ne" || a === "se",
    aba: a === "s" || a === "sw" || a === "se",
  };
}

/** Reparte un desplazamiento de puntero en cuanto se ha movido cada lado. */
function desplazamiento(
  a: Asider,
  dx: number,
  dy: number,
): { l: number; r: number; t: number; b: number } {
  const l = lados(a);
  return {
    l: l.izq ? dx : 0,
    r: l.der ? dx : 0,
    t: l.arr ? dy : 0,
    b: l.aba ? dy : 0,
  };
}

const entero = (n: number) => Math.round(n);
/** Nunca por debajo de cero: una posicion negativa se sale del rollo por la izquierda. */
const noNegativo = (n: number) => Math.max(0, entero(n));

/**
 * El multiplo de 8 mas cercano, con un suelo de 8.
 *
 * "Mas cercano" y no "el siguiente por encima" porque el error de cuantizacion se nota menos
 * repartido: pedir 100 y quedarse en 104 suma 4 dots de golpe, mientras que pedir 104 y
 * quedarse en 104 no suma nada. El ancho de un `^GFA` no es continuo, y hay que elegir de
 * que lado se come la diferencia.
 */
function multiploDe8(n: number): number {
  return Math.max(8, Math.round(n / 8) * 8);
}

/**
 * La zona nueva tras arrastrar un asa `dx`, `dy` dots.
 *
 * Devuelve la zona sin tocar si el reescalado del logo falla (medida demasiado pequena, o un
 * `^GF` ilegible). Un fallo aqui no debe dejar la zona a medias, que es como se pierde el
 * dibujo entero por haber tirado del borde un poco de mas.
 */
export function redimensionar(
  zona: LabelZone,
  a: Asider,
  dx: number,
  dy: number,
  ctx: ContextoResize,
): LabelZone {
  const d = desplazamiento(a, dx, dy);
  // Cuanto se estira la caja por la derecha y por abajo. Los lados izquierdo y superior
  //(restan) se tienen en cuenta aparte, porque ademas mueven la posicion.
  const dAncho = d.r - d.l;
  const dAlto = d.b - d.t;

  if (zona.kind === "shape") {
    return {
      ...zona,
      x: noNegativo(zona.x + d.l),
      y: noNegativo(zona.y + d.t),
      widthDots: Math.max(MIN_DOTS.ancho, entero(zona.widthDots + dAncho)),
      heightDots: Math.max(MIN_DOTS.alto, entero(zona.heightDots + dAlto)),
    };
  }

  if (zona.kind === "graphic") {
    const antes = graphicDots(zona.gf);
    if (!antes.dots) return zona;
    const w0 = antes.dots.w;
    const h0 = antes.dots.h;
    // El ancho se ajusta AL MULTIPLO DE 8 MAS CERCANO, no al siguiente por encima, y se hace
    // ANTES de calcular el factor.
    //
    // `^GFA` no admite cualquier ancho, y `scaleGraphic()` lo sube al multiplo de 8 que le
    // toca. Si se le pidiera 281 dots, devolveria 288 (36 bytes): cuatro dots de mas. Si el
    // factor se calculara con 281, el alto saldria de 281/200 y el logo ya saldria deforme
    // ANTES de que el ajuste lo empeorara. Ajustando aqui, el error que queda es de un solo
    // paso de cuantizacion en vez de los dos sumados.
    const wPedido = multiploDe8(w0 + dAncho);
    const hPedido = Math.max(MIN_DOTS.alto, entero(h0 + dAlto));

    // Proporcion del dibujo, con un caso especial que importa: cuando solo se tira de UN eje,
    // ese eje manda y el otro le sigue. Si se aplicara siempre el minimo de los dos, tirar del
    // borde derecho daria factor min(1,4; 1,0) = 1,0 y el logo no creeria nada, porque el alto
    // no se ha movido. Solo cuando se tiran los dos a la vez tiene sentido el minimo, para no
    // pasarse del lado que se ha tirado menos.
    const factor =
      dAncho !== 0 && dAlto === 0
        ? wPedido / w0
        : dAlto !== 0 && dAncho === 0
          ? hPedido / h0
          : Math.min(wPedido / w0, hPedido / h0);
    // El ancho que sale del factor tambien se ajusta a multiplo de 8, y no solo el pedido: al
    // tirar en vertical, 200 * 94/67 = 280,6 y pedir 281 haria que `scaleGraphic()` lo subiera a
    // 288 (36 bytes), que es 8 dots de error de una vez. Ajustando aqui se queda en 280, que es
    // el multiplo mas cercano y el que menos deforma.
    const r = scaleGraphic(
      zona.gf,
      multiploDe8(w0 * factor),
      Math.max(MIN_DOTS.alto, Math.round(h0 * factor)),
    );
    if ("error" in r) return zona;

    return {
      ...zona,
      x: noNegativo(zona.x + d.l),
      y: noNegativo(zona.y + d.t),
      gf: r.gf,
    };
  }

  if (zona.kind === "barcode") {
    // Con `center` la `x` de la zona no se usa: `barcodeX()` recentra el simbolo en el rollo.
    // Tocarla haria que la caja del editor se moviese mientras el simbolo se queda quieto, que
    // es peor que no poder moverlo.
    const nuevo: LabelZone = {
      ...zona,
      y: noNegativo(zona.y + d.t),
      heightDots: Math.max(MIN_DOTS.altoBarra, entero(zona.heightDots + dAlto)),
    };
    if (!zona.center) {
      (nuevo as { x: number }).x = noNegativo(zona.x + d.l);
    }
    if (dAncho !== 0 && ctx.modulos > 0) {
      // Un simbolo mide `modulos * moduleWidth` dots, asi que el ancho de simbolo NO es una
      // magnitud continua: los saltos son de `modulos` dots (95 en un EAN-13). Convertir el
      // arrastre a modulos con `Math.round` hacia el mas proximo haria que 94 de 95 dots ya
      // sumaran un modulo entero, y el tirador responderia antes de tiempo. Se usa `trunc`
      // hacia el interior: hay que recorrer un modulo COMPLETO para que cambie, tanto al
      // agrandar como al encoger. Es lo que hace que el ancho de las barras sea un escalon y no
      // un mando continuo, y conviene que se note en el raton en vez de contar modulos.
      const bruto = zona.moduleWidth + dAncho / ctx.modulos;
      const modules = dAncho > 0 ? Math.floor(bruto) : Math.ceil(bruto);
      (nuevo as { moduleWidth: number }).moduleWidth = Math.min(10, Math.max(1, modules));
    }
    return nuevo;
  }

  // `text`: vertical es alto de letra, horizontal es ancho de caja.
  const altoNuevo = Math.max(MIN_DOTS.alto, entero(altoDeFuente(zona) + dAlto));

  // El ancho de caja solo se puede cambiar si hay uno conocido. Sin `maxWidthDots` y sin la
  // medida del render no hay base, y subir y bajar el tirador haria cambiar el alto de letra
  // sin avisar de que el ancho no se movio.
  const baseCaja = zona.maxWidthDots ?? ctx.anchoCajaTexto;
  const anchoCaja =
    baseCaja === undefined
      ? zona.maxWidthDots
      : Math.max(MIN_DOTS.ancho, entero(baseCaja + dAncho));

  return {
    ...zona,
    x: noNegativo(zona.x + d.l),
    y: noNegativo(zona.y + d.t),
    ...conAltoDeFuente(zona, altoNuevo),
    ...(anchoCaja === undefined ? {} : { maxWidthDots: anchoCaja }),
  } as LabelZone;
}

/** Alto de fuente en dots, tal y como esta ahora mismo en la zona. */
export function altoDeFuente(z: LabelZone): number {
  if (z.kind !== "text") return 0;
  if (z.autoFit) return z.autoFit.maxHeight;
  const m = /\^A0N,(\d+),/.exec(z.format);
  return m ? Number.parseInt(m[1], 10) : 0;
}

/** Ancho de celda de caracter en dots, tal y como esta ahora mismo en la zona. */
export function anchoDeFuente(z: LabelZone): number {
  if (z.kind !== "text") return 0;
  if (z.autoFit) return Math.round(z.autoFit.maxHeight * z.autoFit.widthRatio);
  const m = /\^A0N,(\d+),(\d+)/.exec(z.format);
  return m ? Number.parseInt(m[2], 10) : 0;
}

/**
 * Cambia el alto de fuente. Con `autoFit` manda sobre el techo; sin el, sobre el `format`.
 *
 * El ancho de celda sigue la misma proporcion que el alto para no deformar la letra, que es
 * justo lo que se ve si solo se cambia el alto.
 */
function conAltoDeFuente(z: LabelZone, alto: number): Record<string, unknown> {
  if (z.kind !== "text") return {};
  const h = Math.max(MIN_DOTS.alto, entero(alto));
  if (z.autoFit) {
    const ancho = Math.max(1, Math.round(h * z.autoFit.widthRatio));
    return { autoFit: { ...z.autoFit, maxHeight: h }, format: `^A0N,${h},${ancho}` };
  }
  const w = Math.max(1, Math.round((anchoDeFuente(z) * h) / Math.max(1, altoDeFuente(z))));
  return { format: `^A0N,${h},${w}` };
}

/**
 * Que se puede redimensionar de esta zona, para la pantalla.
 *
 * Una zona que devuelve `false` en un eje no recibe asas en ese eje, en vez de recibirlas y no
 * hacer nada: un tirador que no responde parece un fallo.
 */
export function ejesRedimensionables(z: LabelZone): { x: boolean; y: boolean; nota: string } {
  if (z.kind === "shape") return { x: true, y: true, nota: "" };
  if (z.kind === "graphic") {
    return { x: true, y: true, nota: "Se reescala el dibujo manteniendo la proporcion." };
  }
  if (z.kind === "barcode") {
    // `center` no es un detalle: decide si la x de la zona coloca algo. Con `center: true`,
    // `barcodeX()` recentra el simbolo y esa x se ignora; sin el, la x es donde empieza el
    // simbolo y si manda. La nota se mira en la ZONA, no en la plantilla actual: una plantilla
    // con `center: false` leyendo "su x no se usa" llevaria al usuario a mover un numero que no
    // imprime nada, que es lo contrario de ayuda.
    const centrado = z.center !== false;
    return {
      x: false,
      y: true,
      nota:
        "En horizontal no se puede: un EAN-13 mide 95 modulos fijos. Lo que se negocia es el " +
        "ancho de cada modulo, con el campo de abajo. " +
        (centrado
          ? "Y como el simbolo va centrado, su x no se usa: se recentra solo."
          : "La x si manda: situa el principio del simbolo."),
    };
  }
  return {
    x: true,
    y: true,
    nota: "Vertical cambia el alto de letra; horizontal, el ancho de la caja donde se parte el texto.",
  };
}
