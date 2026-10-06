/**
 * Geometria del marco de seleccion del editor.
 *
 * QUE ES
 *
 * El marco es el rectangulo que rodea a una zona en `/editor`: el que se arrastra para
 * moverla y el que lleva las ocho asas para estirarla. No es una caja del render: sale de
 * la ZONA misma, con la misma informacion que usaria `emit()`, y por eso puede calcularse
 * en el navegador sin esperar a nada.
 *
 * POR QUE NO VIENE DEL SERVIDOR
 *
 * Las cajas del render (`preview.cajas`) tardan unos 300 ms en llegar: debounce por medio y
 * render por el otro. Con ese dibujo como origen, un arrastre se ve congelado mientras el
 * servidor piensa, que es exactamente la sensacion de "no va" que este modulo existe para
 * evitar. El marco, en cambio, se recalcula con cada fotograma del arrastre y sigue al
 * puntero 1 a 1; cuando el render nuevo llega, el marco se ajusta a la verdad impresa.
 *
 * Que cada estimacion sea UNA APROXIMACION no importa mientras lo sea de la misma forma en
 * que calcula `emit()`: la caja de texto es la caja `^FB`, el alto del bloque es
 * `n * alto + (n - 1) * separacion` con la separacion igual al alto de la fuente (lo que hace
 * la impresora cuando `^FB` lleva 0), y el logo mide lo que mide su `^GFA`. Con eso el marco
 * y el render apuntan a la misma geometria, y los detalles (redondeos, reflow) los resuelve
 * el servidor al renderizar.
 *
 * ES GEOMETRIA PURA: ni React, ni DOM, ni red. Se prueba con `scripts/check-marco.ts`.
 */

import { graphicDots } from "./gf-graphic";
import { altoDeFuente, lados, type Asider } from "./label.resize";
import type { LabelZone } from "./label.template";

/** Rectangulo en dots, con el mismo nombre de campo que las cajas del render. */
export interface Marco {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Lo que hace falta saber de la zona ademas de la propia zona para estimar su caja. */
export interface ContextoMarco {
  /**
   * Ancho en dots del simbolo dibujado, del preview. Si es 0 (aun no hay render) se estima
   * con 95 modulos, que es el caso EAN-13 y el que decide el diseno.
   */
  anchoSimbolo: number;
  /** Texto RESUELTO de la zona, si es de texto (el que se imprimira, con prefijo ya puesto). */
  texto?: string | null;
  /** Alto de letra resuelto en dots. Si falta o es 0, se lee de la zona. */
  altoLetra?: number;
  /** Ancho de celda resuelto en dots, para contar lineas. */
  anchoCelda?: number;
}

function rect(x: number, y: number, w: number, h: number): Marco {
  return { x0: x, y0: y, x1: x + Math.max(1, w), y1: y + Math.max(1, h) };
}

/**
 * La caja que deberia rodear a esta zona, estimada desde la zona y el ultimo render.
 *
 * Devuelve `null` solo si no hay geometria que mirar (un `^GFA` ilegible, un tipo de zona
 * desconocido): ahi no hay marco que dibujar, y la zona sigue siendo editable a traves de los
 * campos numericos.
 *
 * El rectangulo NO es la extension del texto impreso, sino el AREA EDITABLE: para un texto con
 * `maxWidthDots` es la caja `^FB` entera, que es lo que cambia cuando se estira por los lados.
 * El texto centrado o alineado a la derecha queda dentro, como en la impresora.
 */
export function cajaEstimada(zona: LabelZone, ctx: ContextoMarco): Marco | null {
  if (zona.kind === "shape") {
    return rect(zona.x, zona.y, zona.widthDots, zona.heightDots);
  }

  if (zona.kind === "graphic") {
    const d = graphicDots(zona.gf).dots;
    if (!d) return null;
    return rect(zona.x, zona.y, d.w, d.h);
  }

  if (zona.kind === "barcode") {
    const ancho =
      ctx.anchoSimbolo > 0 ? ctx.anchoSimbolo : Math.max(1, zona.moduleWidth * 95);
    // La caja del render incluye la linea de interpretacion: `drawEan13()` la mete en la
    // misma caja, y el editor tiene que estirar el mismo rectangulo que se ve.
    const hri = zona.interpretationLine ? (zona.hriHeightDots ?? 14) : 0;
    return rect(zona.x, zona.y, ancho, zona.heightDots + hri);
  }

  if (zona.kind === "text") {
    const alto = ctx.altoLetra && ctx.altoLetra > 0 ? ctx.altoLetra : altoDeFuente(zona);
    if (alto <= 0) return null;

    // Ancho de la caja: la de `^FB` si la hay; si no, lo que ocupa el texto; y si tampoco se
    // sabe, un ancho de trabajo para que el marco exista y se pueda arrastrar la posicion.
    const anchoTexto =
      ctx.texto && ctx.anchoCelda ? ctx.texto.length * ctx.anchoCelda : undefined;
    const caja = zona.maxWidthDots ?? anchoTexto ?? 40;

    // Lineas: se parte lo mismo que lo parte `partirLineas()` en el render, con el tope de
    // `maxLines`. El alto del bloque es `n * alto + (n - 1) * separacion`, y la separacion es
    // el alto de la fuente cuando `^FB` lleva 0, que es lo que emite `emit()`.
    const maxLineas = zona.maxLines ?? 1;
    const lineas =
      anchoTexto !== undefined && caja > 0
        ? Math.min(maxLineas, Math.max(1, Math.ceil(anchoTexto / caja)))
        : 1;
    return rect(zona.x, zona.y, caja, (2 * lineas - 1) * alto);
  }

  return null;
}

/** El mismo rectangulo, movido `dx`/`dy` dots. El desplazamiento ya viene redondeado y
 * recortado por quien lo pide (la propia zona, al aplicar el arrastre). */
export function desplazarMarco(base: Marco, dx: number, dy: number): Marco {
  return { x0: base.x0 + dx, y0: base.y0 + dy, x1: base.x1 + dx, y1: base.y1 + dy };
}

export interface LimitesMarco {
  /** Ancho minimo del marco: `MIN_DOTS.ancho`. */
  minAncho: number;
  /** Alto minimo: `MIN_DOTS.alto`, o `MIN_DOTS.altoBarra` en las barras. */
  minAlto: number;
}

/**
 * El marco tras tirar del asa `asa` con el puntero movido `dx`, `dy` dots.
 *
 * Los bordes se mueven CON EL PUNTERO, no con la zona, y esa diferencia es a proposito: el
 * marco tiene que seguir al raton en el mismo fotograma, mientras que la zona cuantiza (un
 * modulo de barcode son 95 dots, el logo va a multiplos de 8, la letra salta de a dots
 * enteros). Durante el arrastre manda el raton; al soltar, el render nuevo ajusta el marco a
 * lo que de verdad se imprime.
 *
 * Solo se recorta en los minimos y en el borde izquierdo/superior del rollo: una caja que se
 * sale por la derecha o por abajo es un problema del solapador (`buscarProblemas()`), no algo
 * que el marco deba impedir mientras se arrastra.
 */
export function estirarMarco(
  base: Marco,
  asa: Asider,
  dx: number,
  dy: number,
  lim: LimitesMarco,
): Marco {
  const l = lados(asa);
  const x0 = l.izq
    ? Math.max(0, Math.min(base.x0 + dx, base.x1 - lim.minAncho))
    : base.x0;
  const x1 = l.der ? Math.max(base.x0 + lim.minAncho, base.x1 + dx) : base.x1;
  const y0 = l.arr
    ? Math.max(0, Math.min(base.y0 + dy, base.y1 - lim.minAlto))
    : base.y0;
  const y1 = l.aba ? Math.max(base.y0 + lim.minAlto, base.y1 + dy) : base.y1;
  return { x0, y0, x1, y1 };
}
