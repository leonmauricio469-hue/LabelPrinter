/**
 * Lectura y reescalado de un campo grafico `^GFA` en ASCII-hex.
 *
 * POR QUE ESTE ARCHIVO EXISTE
 *
 * El logo no es una imagen con un tamano en la plantilla: el tamano va DENTRO del `^GFA`, en la
 * cabecera (`bytesPerRow`) y en el numero total de bytes. `LOGO_DOTS_W` y `LOGO_DOTS_H` eran
 * constantes sueltas al lado del dato, y eso era un fallo esperando: en cuanto alguien
 * reescalara el bitmap, las constantes dirian una cosa y el dibujo otra, y el comprobador de
 * solapes mediria un logo que ya no existe con la misma forma.
 *
 * Por eso `graphicDots()` lee el tamano del propio `^GFA` y todo lo demas usa esa funcion. Una
 * sola fuente de verdad para la medida, y no puede quedar desfasada del dato.
 *
 * FORMATO
 *
 *   ^GFA,a,b,c,d,<hex>
 *
 *   a  tipo de compresion. Aqui siempre `A` (ASCII hex).
 *   b  bytes totales del campo grafico.
 *   c  bytes que se transmiten. Con `A` es igual que `b`.
 *   d  bytes por fila.
 *
 * El ancho en dots es `d * 8`, porque un byte son 8 bits y cada bit un dot. El alto es
 * `b / d` redondeado hacia arriba.
 *
 * Los bytes van separados por comas en el manual, pero este proyecto los emite con saltos de
 * linea, que la GK420t acepta (esta verificado en fisico: el logo sale en la etiqueta) y que
 * hace el fichero legible. Los dos formatos se leen igual aqui.
 */

/** Dimensiones en dots de un campo grafico. */
export interface GraphicDots {
  w: number;
  h: number;
}

interface Cabecera {
  totalBytes: number;
  bytesPerRow: number;
  /** Los bytes del bitmap, en orden de fila. */
  bytes: number[];
  /** Si el original usaba comas como separador, para devolverlo igual. */
  separador: "," | "\n";
}

const PREFIJO = /^(\^GF)([A-Z]),(\d+),(\d+),(\d+),/;

/**
 * Separa cabecera y payload.
 *
 * Devuelve `null` si no parece un `^GFA` legible, para que quien llame pueda avisar en vez de
 * inventarse un dibujo vacio: un logo que se dibuja en blanco es un fallo silencioso.
 */
function parsear(gf: string): Cabecera | null {
  const m = PREFIJO.exec(gf);
  if (!m) return null;

  const totalBytes = Number.parseInt(m[3], 10);
  const bytesPerRow = Number.parseInt(m[5], 10);
  if (totalBytes <= 0 || bytesPerRow <= 0) return null;

  // A partir de la cabecera solo queda el payload, que puede traer comas, saltos de linea o
  // los dos. Todo lo que no sea hex se descarta.
  const payload = gf.slice(m[0].length);
  const hex = payload.replace(/[^0-9a-fA-F]/g, "");

  const bytes: number[] = [];
  for (let i = 0; i + 1 < hex.length; i += 2) {
    bytes.push(Number.parseInt(hex.slice(i, i + 2), 16));
  }
  if (bytes.length === 0) return null;

  return {
    totalBytes,
    bytesPerRow,
    bytes: bytes.slice(0, totalBytes),
    separador: payload.includes(",") ? "," : "\n",
  };
}

/**
 * Tamano en dots de un `^GFA`, leido del propio dato.
 *
 * `fallo` viene con un motivo para poder enseñarlo en pantalla en vez de devolver un cero que
 * luego se dibuja como un logo de 0 x 0 sin decir nada.
 */
export function graphicDots(gf: string): { dots: GraphicDots | null; fallo: string | null } {
  const c = parsear(gf);
  if (!c) return { dots: null, fallo: "el ^GF no se entiende: no es un ^GFA en ASCII-hex" };
  return {
    dots: { w: c.bytesPerRow * 8, h: Math.ceil(c.totalBytes / c.bytesPerRow) },
    fallo: null,
  };
}

/**
 * Reescala un `^GFA` a otras medidas en dots.
 *
 * Vecino mas proximo, sin suavizado: el destino es una impresora termica de 203 dpi que solo
 * sabe imprimir negro o blanco. Interpolar daria grises que el firmware tendria que decidir, y
 * un logo borroso es peor que uno con los bordes justos.
 *
 * EL ANCHO SE AJUSTA A MULTIPLO DE 8
 *
 * Cada fila del bitmap va en bytes enteros y un byte son 8 dots, asi que no existe un `^GFA` de
 * 100 dots: el ancho mas pequeno que lo contiene es 104 (13 bytes). Pedir 100 y dibujar 104 sin
 * decir nada haria que el comprobador de solapes midiera 4 dots mas de los que hay de tinta, y
 * eso se acumula en la cuenta de choques.
 *
 * Por eso el reescalado dibuja sobre el ancho YA AJUSTADO y devuelve las dos medidas: la pedida
 * y la real. La pantalla enseña las dos, para que pedir 35,0 mm y quedarse con 35,0 (que si
 * cabe exacto) no se confunda con pedir 12,5 mm y quedarse con 13,0 sin motivo aparente.
 *
 * Devuelve el `^GFA` nuevo tal cual, con el `^FS` de cierre que exige el contrato de
 * `GraphicZone` (sin el, el campo grafico sale abierto en el ZPL y la impresora se come lo
 * que venga despues), y el error si la medida pedida no tiene sentido.
 */
export function scaleGraphic(
  gf: string,
  wObjetivo: number,
  hObjetivo: number,
): { gf: string; dots: GraphicDots; pedido: GraphicDots } | { error: string } {
  const c = parsear(gf);
  if (!c) return { error: "el ^GF no se entiende, no se puede reescalar" };

  const wPedido = Math.round(wObjetivo);
  const hPedido = Math.round(hObjetivo);

  // Abajos del limite no hay un logo, hay un error de calculo. 8 dots de ancho es un milímetro
  // y a 203 dpi ya no se distingue de una raya.
  if (wPedido < 8 || hPedido < 4) return { error: `medida demasiado pequena: ${wPedido} x ${hPedido} dots` };
  if (wPedido > 4000 || hPedido > 4000) return { error: `medida demasiado grande: ${wPedido} x ${hPedido} dots` };

  const wOriginal = c.bytesPerRow * 8;
  const hOriginal = Math.ceil(c.totalBytes / c.bytesPerRow);
  const bytesPerRow = Math.ceil(wPedido / 8);
  const w = bytesPerRow * 8;
  const h = hPedido;
  const totalBytes = bytesPerRow * h;

  const salida = new Array<number>(totalBytes).fill(0);

  for (let y = 0; y < h; y++) {
    // Fila de origen. `y * hOriginal / h` reparte las filas nuevas sobre las viejas, y el suelo
    // hace que cada fila vieja se use al menos una vez en vez de saltarse alguna.
    const ySrc = Math.min(hOriginal - 1, Math.floor((y * hOriginal) / h));
    for (let b = 0; b < bytesPerRow; b++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = b * 8 + bit;
        const xSrc = Math.min(wOriginal - 1, Math.floor((x * wOriginal) / w));
        const byteSrc = c.bytes[ySrc * c.bytesPerRow + (xSrc >> 3)];
        if (byteSrc === undefined) continue;
        if (byteSrc & (1 << (7 - (xSrc & 7)))) {
          byte |= 1 << (7 - bit);
        }
      }
      salida[y * bytesPerRow + b] = byte;
    }
  }

  const lineas: string[] = [];
  for (let y = 0; y < h; y++) {
    let fila = "";
    for (let b = 0; b < bytesPerRow; b++) {
      fila += salida[y * bytesPerRow + b].toString(16).toUpperCase().padStart(2, "0");
    }
    lineas.push(fila);
  }
  const cuerpo = lineas.join(c.separador === "," ? "," : "\n");

  return {
    // `^FS` en su propia linea, con el mismo formato que trae `LOGO_GF`: los parsers de aqui
    // descartan lo que no sea hex, y la linea del terminador no es una fila del bitmap.
    gf: `^GFA,${totalBytes},${totalBytes},${bytesPerRow},${cuerpo}\n^FS`,
    dots: { w, h },
    pedido: { w: wPedido, h: hPedido },
  };
}

/** El ancho real en dots, que puede ser mayor que el pedido por el redondeo a byte entero. */
export function anchoEfectivo(gf: string): number {
  return graphicDots(gf).dots?.w ?? 0;
}
