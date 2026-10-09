/**
 * Comprobacion de que las cajas de una etiqueta no se estorban entre si.
 *
 * POR QUE ESTA EN UN FICHERO Y NO TRES VECES EN EL CODIGO
 *
 * La regla estaba copiada en el editor, en el endpoint que guarda y en el script de pruebas.
 * Tres copias de un predicado que decide si se puede imprimir o no son tres oportunidades de
 * que no coincidan. Cuando el editor dice "esto no tiene choques" y el servidor responde 422,
 * el boton de aplicar parece roto y no hay forma de saber cual de los dos miente.
 *
 * Aqui hay una sola regla, y los tres la llaman.
 *
 * CONTENER NO ES PISAR, SOLO CUANDO EL QUE CONTIENE ES EL MARCO
 *
 * El marco de la etiqueta es un rectangulo y TODO lo demas va dentro. Eso no es un solape: es
 * lo unico que puede pasar. Un texto metido dentro del marco es una etiqueta bien puesta.
 *
 * PERO ENTRE CONTENIDO NO.
 *
 * Y aqui esta el caso que enseño por que la regla no puede ser general: un texto pequeno
 * metido dentro de la caja de las barras esta encima de las barras. No es que "lo contenga",
 * es que se imprime encima. La exencion de contencion es del marco y solo del marco, porque el
 * marco es un anillo hueco y lo demas va dentro; las barras no son huecas, estan llenas de
 * negro.
 *
 * Por eso hay dos reglas distintas y no una: `intersectan()` para todo lo que se compara
 * contra el marco, y nada mas para el resto. Con una sola regla, o el editor se queja del
 * texto bien puesto dentro del marco, o se calla ante el precio encima del codigo de barras.
 *
 * LO QUE SE AVISA CUANDO EL MARCO ESTA DESPLAZADO
 *
 * Una zona que no llega ni a tocar el marco se queda fuera de el sin llegar a cruzarse, y con
 * la regla de interseccion pasaria desapercibida. Por eso el marco tambien complain de las
 * zonas que se han quedado fuera: un borde por un lado y el contenido en la esquina opuesta es
 * un error de colocacion, no una plantilla valida.
 */

/** Lo minimo que hace falta para saber donde esta una caja. */
export interface Caja {
  etiqueta: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  texto?: string;
  /**
   * Grosor del marco. Solo lo lleva la caja del marco.
   *
   * El marco es un anillo: hay un rectangulo y dentro un hueco. Medir "dentro" contra el
   * rectangulo daria por bueno un texto tumbado encima del borde, que es el error mas facil de
   * cometer arrastrando y el mas dificil de ver a simple vista.
   */
  grosorDots?: number;
}

/** Como se llama una caja en un aviso: el texto si lo tiene, si no su tipo. */
export function nombreDe(c: Caja): string {
  return c.texto ?? c.etiqueta;
}

/** Dos rectangulos tienen area comun. Todo lo que se pisa, se pisa. */
export function intersectan(a: Caja, b: Caja): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/** `a` engloba a `b` entero, bordes incluidos. */
export function contiene(a: Caja, b: Caja): boolean {
  return a.x0 <= b.x0 && a.y0 <= b.y0 && b.x1 <= a.x1 && b.y1 <= a.y1;
}

export interface Problema {
  /** Par de cajas implicadas, o la de una sola si el problema es de esa caja sola. */
  cajas: [Caja, Caja] | [Caja];
  mensaje: string;
  /** `solape`, `fuera` o `marco`: para poder tratarlos distinto si hace falta. */
  tipo: "solape" | "fuera" | "marco";
}

/**
 * Todos los problemas de una etiqueta, en texto.
 *
 * `cajas` debe traer el marco si la plantilla tiene marco. Las que no sean marco se tratan
 * como contenido y se comparan entre si.
 */
export function buscarProblemas(cajas: Caja[], ancho: number, alto: number): Problema[] {
  const salida: Problema[] = [];
  const marco = cajas.find((c) => c.etiqueta === "marco");
  const contenido = cajas.filter((c) => c !== marco);

  // 1) Nada se sale del rollo.
  for (const c of cajas) {
    const que = nombreDe(c);
    if (c.x0 < 0 || c.y0 < 0) {
      salida.push({
        cajas: [c],
        tipo: "fuera",
        mensaje: `"${que}" se sale por la izquierda o por arriba (${c.x0},${c.y0})`,
      });
    }
    if (c.x1 > ancho) {
      salida.push({
        cajas: [c],
        tipo: "fuera",
        mensaje: `"${que}" se sale por la derecha: llega a ${c.x1} y el rollo acaba en ${ancho} dots`,
      });
    }
    if (c.y1 > alto) {
      salida.push({
        cajas: [c],
        tipo: "fuera",
        mensaje: `"${que}" se sale por abajo: llega a ${c.y1} y el rollo acaba en ${alto} dots`,
      });
    }
  }

  // 2) Todo lo que se pisa, se pisa. ENTRE CONTENIDO no hay exencion de contencion: un texto
  //    pequeno dentro de la caja de las barras esta encima de las barras, y eso es justo el
  //    fallo que este boton existe para evitar. Solo el marco perdona (punto 3).
  for (let i = 0; i < contenido.length; i++) {
    for (let j = i + 1; j < contenido.length; j++) {
      const a = contenido[i];
      const b = contenido[j];
      if (!intersectan(a, b)) continue;
      // El par se ordena para que el mismo choque produzca siempre el mismo texto, con el
      // mismo orden de zonas o no el aviso cambia entre ejecuciones.
      const [p, q] = nombreDe(a) <= nombreDe(b) ? [a, b] : [b, a];
      salida.push({
        cajas: [p, q],
        tipo: "solape",
        mensaje: `"${nombreDe(p)}" pisa a "${nombreDe(q)}"`,
      });
    }
  }

  // 3) El marco, que es un anillo: el contenido tiene que estar dentro del hueco, no solo
  //    dentro del rectangulo. El grosor por el lado de dentro es lo que separa "dentro" de
  //    "encima del borde".
  if (marco) {
    const grosor = Math.max(1, grosorDeMarco(marco));
    const dentro = {
      ...marco,
      x0: marco.x0 + grosor,
      y0: marco.y0 + grosor,
      x1: marco.x1 - grosor,
      y1: marco.y1 - grosor,
    };
    for (const c of contenido) {
      if (!intersectan(marco, c)) {
        // Ni roza el marco: se ha quedado fuera de el. Sin este aviso pasaria, porque una caja
        // que no toca el marco tampoco lo cruza, y con la regla de interseccion sola se
        // considerarian bien colocadas.
        salida.push({
          cajas: [marco, c],
          tipo: "marco",
          mensaje: `"${nombreDe(c)}" se ha quedado fuera del marco`,
        });
        continue;
      }
      // Raza el marco, asi que tiene que caber ENTERA en el hueco. Si asoma un solo dot fuera
      // del borde interior, ese dot se imprime encima del marco, y con un grosor de 1 dot eso
      // no se ve ni de cerca. La contencion es exacta y con bordes incluidos: un texto pegado
      // justo al borde interior, sin pasarse, es correcto y no se avisa.
      if (!contiene(dentro, c)) {
        salida.push({
          cajas: [marco, c],
          tipo: "marco",
          mensaje: `"${nombreDe(c)}" se cruza con el borde del marco`,
        });
      }
    }
  }

  return salida;
}

/**
 * Grosor del marco en dots.
 *
 * No se puede leer de la caja, que no lo lleva: el render la dibuja pero solo mide el
 * rectangulo. Asi que se deduce de lo que hay dibujado, que es lo unico fiable sin volver a
 * pedir el `^GB` entero. Un marco sin grosor medido se trata como de 1 dot, que es lo mas
 * fino que puede ser.
 */
function grosorDeMarco(marco: Caja): number {
  return typeof marco.grosorDots === "number" && marco.grosorDots > 0
    ? Math.round(marco.grosorDots)
    : 1;
}

/** Los problemas en texto, para pintar una lista. */
export function problemasEnTexto(p: Problema[]): string[] {
  return p.map((x) => x.mensaje);
}
