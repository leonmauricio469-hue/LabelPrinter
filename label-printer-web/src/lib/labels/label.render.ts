import { deflateSync } from "node:zlib";
import { buildZpl, symbolDots, quietZoneDots, barcodeZoneOf, planForZone } from "./zpl.builder";
import { graphicDots } from "./gf-graphic";
import type { LabelData } from "./label.types";
import type { LabelTemplate, BarcodeZone } from "./label.template";
import { encodeCode128Auto } from "./code128";
import { EAN13_MODULES } from "./ean13";

/**
 * Dibuja una etiqueta a PNG, a la resolucion real de la impresora.
 *
 * ESTA ES LA PIEZA QUE COMPARTEN `scripts/render-label.ts` y `/editor`.
 *
 * Lo importante es que dibuja el ZPL que produce `buildZpl()`, no una aproximacion hecha a
 * mano desde los numeros de la plantilla. Si alguien cambia una zona, el PNG sale como sale
 * el ZPL; si el PNG queda bien, el ZPL esta bien. Un renderizador aparte, dibujando cada
 * elemento por su cuenta, daria verde en verde con dos medidas distintas.
 *
 * Sale del ZPL.parseando linea a linea (`^FO`, `^A0`, `^FB`, `^BY`, `^BC`/`^BE`, `^FD`),
 * que es lo que hace el firmware de verdad y no una lectura de la plantilla.
 */

const FONT: Record<string, string> = {
  "0": "25552", "1": "26227", "2": "71747", "3": "71717", "4": "55711",
  "5": "74717", "6": "74757", "7": "71111", "8": "75757", "9": "75717",
  A: "75755", B: "65656", C: "74447", D: "65556", E: "74647",
  F: "74644", G: "74557", H: "55755", I: "72227", J: "11157",
  K: "55655", L: "44447", M: "57755", N: "57775", O: "75557",
  P: "75744", Q: "75711", R: "75655", S: "74717", T: "72222",
  U: "55557", V: "55552", W: "55775", X: "55255", Y: "55722",
  Z: "71247", " ": "00000", $: "27272", ".": "00001", ",": "00024",
  "-": "00700", _: "00007", "/": "11244", "&": "52536", ":": "02020",
  "#": "57575", "(": "24442", ")": "41114", "+": "02720", "!": "22202",
  "?": "71202", "*": "52252", "%": "56215",
};

export interface RenderedZone {
  etiqueta: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Texto tal y como sale en `^FD`, ya plegado a ASCII. */
  texto?: string;
  /** Alto de fuente resuelto (el de `autoFit` si la zona lo tiene, si no el de `format`). */
  alto?: number;
  anchoUsado?: number;
  /**
   * Grosor del marco. Solo lo lleva la caja del marco.
   *
   * El marco es un anillo: hay un rectangulo y, dentro, un hueco. Para decir si una zona esta
   * "dentro" hace falta saber cuanto se come el borde, y sin este numero lo unico que se puede
   * medir es el rectangulo, que daria por buena una zona tumbada justo encima del borde.
   */
  grosorDots?: number;
}

export interface RenderResult {
  png: Buffer;
  /**
   * El lienzo en crudo, un byte por dot: 0 si hay tinta, 255 si no. Sin comprimir y a escala 1.
   *
   * Va aparte del `png` porque `png` es un PNG comprimido, y de un PNG no se leen pixeles sin
   * descomprimirlo. Es lo que permite mirar la etiqueta en texto (`ver-ascii.ts`) y lo que
   * haria falta para cualquier medida sobre la tinta, tipo "cuantos dots negros hay en el
   * logo". Tamano `widthDots * heightDots`.
   */
  puntos: Buffer;
  /** Cajas de todo lo dibujado, en dots. Es lo que usa la UI para colocar los campos. */
  cajas: RenderedZone[];
  /** Linea de la consola de `render-label`, por si el editor la quiere teach. */
  informe: string[];
  symbology: "ean13" | "code128" | null;
  /** Datos que realmente se imprimen, que no son siempre los del producto. */
  datosImpresos: string | null;
  anchoSimbolo: number;
  zonaQuieta: number;
  /**
   * Dots negros del logo realmente pintados.
   *
   * 0 significa que no se ha dibujado nada, sea porque no hay zona grafica, porque su `^GFA` no
   * aparece en el ZPL, o porque el bitmap venia vacio. Las tres cosas se ven igual desde fuera
   * sin este numero, y son fallos muy distintos.
   */
  pixelesLogo: number;
}

/**
 * Ancho que ocupa un texto, en dots.
 *
 * En ZPL, `^A0N,alto,ancho` hace que CADA CARACTER ocupe `ancho` dots: el ancho es el avance
 * de la celda, no el ancho del glifo. Aqui se dibujo el glifo de 3 columnas repartido dentro
 * de una celda de `wDot`, con una separacion proportional, y el avance es `wDot` clavado.
 *
 * Importa porque `resolveAutoFit()` en `zpl.builder.ts` calcula el ajuste con
 * `caracteres * ancho <= maxWidthDots`: si el renderer midiera distinto, las cajas que ve el
 * editor no cuadrarian con el ajuste que decide el alto de letra, y aparecerian solapes que
 * en papel no existen.
 */
export function textBox(text: string, xDot: number, yDot: number, hDot: number, wDot: number) {
  const used = text.length * wDot;
  return { x0: xDot, y0: yDot, x1: xDot + used, y1: yDot + hDot };
}

/**
 * Reparte un texto en las lineas que draw dentro de la caja del `^FB`.
 *
 * Es la contraparte de `resolveAutoFit()` y tiene que medir con la misma regla que el, porque
 * de eso depende que el alto que se elige y las lineas que se dibujan sean el mismo hecho:
 * `^A0N,alto,ancho` hace que CADA CARACTER ocupe `ancho` dots, asi que una linea admite
 * `floor(caja / ancho)` caracteres.
 *
 * Parte por PALABRAS, que es lo que hace la impresora, y parte la palabra en mitad si ella
 * sola no cabe, que tambien. Sin esa segunda parte, un nombre de una palabra larguisima
 * ("SUPERCALIFRAGILISTICOEXPIALIDOCIOUS") se dibujaria entero en una linea y se saldria de
 * la etiqueta, y el nombre de un producto de 68 caracteres es justo el caso que motivo todo
 * el cambio de layout.
 *
 * El limite de lineas es el `maxLines` del `^FB`. Lo que no cabe en ese numero de lineas se
 * DIBUJA IGUAL, en una linea mas larga, en vez de recortarse: aqui no se imprime, es una
 * previsualizacion, y callarse un texto que en el papel se recorta enseña una etiqueta
 * distinta de la real. El aviso de "se pasa" lo pone el llamante por cada linea.
 */
export function partirLineas(text: string, wDot: number, caja: number, maxLineas: number): string[] {
  if (caja <= 0 || wDot <= 0) return [text];
  const porLinea = Math.max(1, Math.floor(caja / wDot));
  if (text.length <= porLinea) return [text];

  const salida: string[] = [];
  let actual = "";
  for (const palabra of text.split(" ")) {
    // Una palabra mas ancha que la caja no se puede colocar entera: se parte en trozos del
    // ancho justo, como hace la impresora, y el trozo que sobra empieza la linea siguiente.
    for (const trozo of trocear(palabra, porLinea)) {
      // Un trozo de una palabra larga NO lleva espacio delante aunque no sea el primero: son
      // trozos de la MISMA palabra y un espacio los separaria en papel. Con el espacio de mas,
      // un nombre de una palabra de 100 caracteres salia en trozos de 20,20,20,41: el
      // ultimo se pasaba de la caja y ademas aparecia un hueco en medio de la palabra.
      //
      // El caso de "MITAD DE" se resolvia solo: la palabra MIDAD ocupa 5, luego un espacio
      // lleva a 6, y 6+DE=8 no cabe, asi que la linea se cierra en 5 con su espacio. La
      // condicion de arriba no cambia ese camino, solo quita el espacio entre trozos.
      const conEspacio = actual === "" || actual.endsWith(" ") ? trozo : `${actual} ${trozo}`;
      if (conEspacio.length <= porLinea) {
        actual = conEspacio;
        continue;
      }
      if (actual !== "") salida.push(actual);
      actual = trozo;
    }
  }
  if (actual !== "") salida.push(actual);

  // Se recorta al numero de lineas que permite el `^FB`; lo que sobra se mantiene pegado a
  // la ultima, que es lo que se ve en el papel, y el llamante avisa por el ancho.
  if (salida.length <= maxLineas) return salida;
  return [...salida.slice(0, maxLineas - 1), salida.slice(maxLineas - 1).join(" ")];
}

/** Trocea una palabra en trozos de `porLinea` caracteres. */
function trocear(palabra: string, porLinea: number): string[] {
  if (palabra.length <= porLinea) return [palabra];
  const trozos: string[] = [];
  for (let i = 0; i < palabra.length; i += porLinea) trozos.push(palabra.slice(i, i + porLinea));
  return trozos;
}

export function renderLabel(
  template: LabelTemplate,
  data: LabelData,
  opts: { scale?: number; grid?: boolean } = {},
): RenderResult {
  const SCALE = Math.max(1, Math.min(8, opts.scale ?? 3));
  const GRID_ON = opts.grid ?? true;

  const widthDots = template.widthDots;
  const heightDots = template.heightDots;
  const W = widthDots * SCALE;
  const H = heightDots * SCALE;
  const px = Buffer.alloc(W * H * 3, 0xff);

  type Rgb = [number, number, number];
  const BLACK: Rgb = [0, 0, 0];
  const TEXT: Rgb = [70, 70, 70];
  const GRID: Rgb = [228, 228, 228];
  const EDGE: Rgb = [255, 55, 55];
  const FB: Rgb = [150, 195, 255];
  const OKEDGE: Rgb = [0, 150, 0];
  const BADEDGE: Rgb = [225, 45, 45];
  // El marco va en gris medio: se ve lo justo para saber donde esta el borde y agarrarlo en el
  // editor, sin que se confunda con el contenido (texto y barras son casi negros).
  const MARCO: Rgb = [170, 170, 170];

  const informe: string[] = [];
  const cajas: RenderedZone[] = [];

  function rect(xDot: number, yDot: number, wDot: number, hDot: number, c: Rgb) {
    const x0 = xDot * SCALE;
    const y0 = yDot * SCALE;
    const w = wDot * SCALE;
    const h = hDot * SCALE;
    for (let y = y0; y < y0 + h; y++) {
      if (y < 0 || y >= H) continue;
      for (let x = x0; x < x0 + w; x++) {
        if (x < 0 || x >= W) continue;
        const i = (y * W + x) * 3;
        px[i] = c[0];
        px[i + 1] = c[1];
        px[i + 2] = c[2];
      }
    }
  }
  const vLine = (x: number, y0: number, y1: number, c: Rgb) => rect(x, y0, 1, Math.max(1, y1 - y0), c);
  const hLine = (x0: number, x1: number, y: number, c: Rgb) => rect(x0, y, Math.max(1, x1 - x0), 1, c);
  /**
   * Un tramo del `^GB`, con su grosor.
   *
   * El grosor va hacia DENTRO de la caja, que es como lo dibuja la Zebra: `^GB` deja el
   * rectangulo de `w` x `h` y el borde Come desde la esquina. Dibujarlo hacia fuera haria que
   * el marco de la pantalla pareciera un dot mas grande que el de la etiqueta.
   */
  const marcoLine = (
    xa: number,
    ya: number,
    xb: number,
    yb: number,
    grosor: number,
    c: Rgb,
  ) => {
    const t = Math.max(1, grosor);
    if (ya === yb) rect(xa, ya, xb - xa, t, c);
    else rect(xa, ya, t, yb - ya, c);
  };

  /**
   * Dibuja `text` con celdas de `wDot` de ancho y `hDot` de alto. Devuelve el ancho usado.
   *
   * El glifo de 3 columnas se reparte dentro de la celda: `celda = wDot / 3`, con la
   * separacion proporcional. El avance es `wDot` exacto, que es lo que significa el ancho en
   * `^A0N,alto,ancho` y lo que mide `resolveAutoFit()`.
   */
  function drawText(xDot: number, yDot: number, hDot: number, wDot: number, text: string, c: Rgb): number {
    const cw = Math.max(1, Math.floor(wDot / 3));
    const gap = Math.max(0, Math.floor((wDot - cw * 3) / 2));
    const rowH = Math.max(1, Math.floor(hDot / 5));
    let cx = xDot;
    for (const ch of text) {
      const glyph = FONT[ch.toUpperCase()] ?? FONT["?"];
      for (let ry = 0; ry < 5; ry++) {
        const bits = glyph.charCodeAt(ry) - 48;
        for (let rx = 0; rx < 3; rx++) {
          if (bits & (4 >> rx)) {
            rect(cx + rx * cw + gap, yDot + ry * rowH, cw, rowH, c);
          }
        }
      }
      cx += wDot;
    }
    return cx - xDot;
  }

  /**
   * Dibuja un `^GFA` y devuelve cuantos dots negros ha pintado.
   *
   * El recuento no es cosmetico: sin el, "el logo se dibuja" y "el logo se pinta en blanco" son
   * indistinguibles desde fuera, y un fallo asi no se ve en un test que mire cajas. Con el, un
   * test puede decir que un logo reescalado sigue teniendo tinta, que es lo unico que importa.
   */
  function drawGraphic(gf: string, xDot: number, yDot: number): number {
    const m = gf.match(/\^GFA,(\d+),(\d+),(\d+),([\s\S]*)/);
    if (!m) return 0;
    const bytesPerRow = Number.parseInt(m[3], 10);
    const hex = m[4].replace(/[^0-9a-fA-F]/g, "");
    const bytes: number[] = [];
    for (let i = 0; i + 1 < hex.length; i += 2) bytes.push(Number.parseInt(hex.slice(i, i + 2), 16));
    let negros = 0;
    for (let r = 0; r * bytesPerRow < bytes.length; r++) {
      for (let b = 0; b < bytesPerRow; b++) {
        const v = bytes[r * bytesPerRow + b];
        if (v === undefined) break;
        for (let bit = 0; bit < 8; bit++) {
          if (v & (1 << (7 - bit))) {
            rect(xDot + b * 8 + bit, yDot + r, 1, 1, BLACK);
            negros++;
          }
        }
      }
    }
    return negros;
  }

  function quietOk(x: number, right: number, moduleW: number) {
    return right <= widthDots && x >= 10 * moduleW && widthDots - right >= 10 * moduleW;
  }

  function drawEan13(text: string, xDot: number, yDot: number, hDot: number, moduleW: number) {
    const total = EAN13_MODULES * moduleW;
    for (let m = 0; m < EAN13_MODULES; m++) {
      const inGuard = m < 3 || (m >= 45 && m < 50) || m >= 92;
      const on = inGuard ? m % 2 === 0 : (m * 7 + 3) % 3 !== 0;
      if (on) rect(xDot + m * moduleW, yDot, moduleW, hDot, BLACK);
    }
    const hriH = 12;
    const hri = textBox(text, xDot, yDot + hDot + 2, hriH, 7);
    drawText(xDot, yDot + hDot + 2, hriH, 7, text, TEXT);
    const right = xDot + total;
    const ok = quietOk(xDot, right, moduleW);
    vLine(right, yDot, yDot + hDot, ok ? OKEDGE : BADEDGE);
    informe.push(
      `EAN-13: ${EAN13_MODULES} mod x ${moduleW} = ${total} dots (${(total / 8).toFixed(1)} mm)` +
        `  x ${xDot}..${right}  quieta ${xDot}/${widthDots - right} dots` +
        ` (${(xDot / 8).toFixed(2)}/${((widthDots - right) / 8).toFixed(2)} mm, min 10X = ${(10 * moduleW / 8).toFixed(2)} mm)  ${ok ? "OK" : "FALLA"}`,
    );
    cajas.push({ etiqueta: "barras", x0: xDot, y0: yDot, x1: right, y1: hri.y1 });
    return { total, right, ok };
  }

  function drawCode128(text: string, xDot: number, yDot: number, hDot: number, moduleW: number) {
    const { encoded, note } = encodeCode128Auto(text);
    const total = encoded.modules * moduleW;
    let cx = xDot;
    let bar = true;
    for (const w of encoded.widths) {
      if (bar) rect(cx, yDot, w * moduleW, hDot, BLACK);
      cx += w * moduleW;
      bar = !bar;
    }
    const hriH = 12;
    const hri = textBox(text, xDot, yDot + hDot + 2, hriH, 7);
    drawText(xDot, yDot + hDot + 2, hriH, 7, text, TEXT);
    const right = xDot + total;
    const ok = quietOk(xDot, right, moduleW);
    vLine(right, yDot, yDot + hDot, ok ? OKEDGE : BADEDGE);
    informe.push(
      `CODE 128 automatico (${note}): ${encoded.modules} mod x ${moduleW} = ${total} dots (${(total / 8).toFixed(1)} mm)` +
        `  x ${xDot}..${right}  quieta ${xDot}/${widthDots - right} dots  ${ok ? "OK" : "FALLA"}`,
    );
    cajas.push({ etiqueta: "barras", x0: xDot, y0: yDot, x1: right, y1: hri.y1 });
    return { total, right, ok };
  }

  // ------------------------------------------------------------------ lienzo de fondo
  if (GRID_ON) {
    for (let d = 0; d <= widthDots; d += 8) vLine(d, 0, H, GRID);
    for (let d = 0; d <= heightDots; d += 8) hLine(0, W, d, GRID);
  }
  vLine(widthDots - 1, 0, H, EDGE);
  hLine(0, W, heightDots - 1, EDGE);

  const zpl = buildZpl(template, data);
  const { zones } = (function () {
    // `resolveLabel` no se exporta con esa forma; se re-resuelve por el camino del builder
    // para no duplicar la eleccion de zonas sin barras.
    const bz = barcodeZoneOf(template);
    const plan = bz ? planForZone(template, bz, data.barcode) : null;
    const sinCodigo = plan && !plan.printable && template.zonesWithoutBarcode;
    return { zones: sinCodigo ? template.zonesWithoutBarcode! : template.zones };
  })();

  // El ^GFA se dibuja desde LA ZONA, no buscando `^GFA` en el ZPL con un regex.
  //
  // Antes se hacia `zpl.match(/\^GFA,[\s\S]*?\n\^FS/)`, que parecia funcionar y no: el patron
  // se comia el payload entero y "`\n^FS`" era el `^FS` del PRIMER texto que hubiera despues, o
  // sea que casaba por casualidad con el separador de linea que traia el logo generado y no con
  // nada que tuviera que ver con el fin del campo. En cuanto `scaleGraphic()` reescribio el
  // separador, el logo desaparecio de la previsualizacion sin ningun error: el regex, en vez de
  // fallar, seguia casando con otra cosa.
  //
  // La zona lleva el `^GFA` EXACTO que `emit()` mete en el ZPL, sin transformar, asi que de ahi
  // sale. Y para que un desajuste futuro se vea en vez de pasar, se comprueba que ese texto este
  // de verdad en el ZPL que se acaba de construir.
  const gfZone = zones.find((z) => z.kind === "graphic");
  let pixelesLogo = 0;
  if (gfZone && gfZone.kind === "graphic") {
    if (!zpl.includes(gfZone.gf)) {
      // Si se llega aqui, el ZPL que se ha construido no lleva este ^GFA. Dibujar la zona aun
      // asi seria enseñar algo que la impresora no va a ver, que es justo el fallo que el
      // editor no puede permitirse.
      informe.push("logo NO DIBUJADO: el ^GFA de la zona no aparece en el ZPL generado.");
    } else {
      pixelesLogo = drawGraphic(gfZone.gf, gfZone.x, gfZone.y);
      if (pixelesLogo === 0) {
        informe.push("logo EN BLANCO: el ^GFA esta en el ZPL pero no tiene ningun dot negro.");
      }
    }

    // La medida sale del `^GFA` que se acaba de dibujar, no de `LOGO_DOTS_W`. Si en `/editor`
    // se reescala el logo, la constante se queda vieja y la caja mediria un logo distinto del
    // dibujado, que es como el comprobador de solapes acaba mintiendo en verde.
    const { dots, fallo } = graphicDots(gfZone.gf);
    if (fallo || !dots) {
      informe.push(`logo NO MEDIDO: ${fallo}. La caja del logo no se puede comprobar.`);
    } else {
      informe.push(`logo ${dots.w} x ${dots.h} dots en ${gfZone.x},${gfZone.y}`);
      cajas.push({
        etiqueta: "logo",
        x0: gfZone.x,
        y0: gfZone.y,
        x1: gfZone.x + dots.w,
        y1: gfZone.y + dots.h,
      });
    }
  }

  // ------------------------------------------------------------------- parseo del ZPL
  let curX = 0;
  let curY = 0;
  let fontH = 0;
  let fontW = 0;
  let byW = 2;
  let bcH = 0;
  let symbology: "ean13" | "code128" | null = null;
  let inBarcode = false;
  let datosImpresos: string | null = null;
  // El `^FB` vigente. En ZPL no caduca con el campo: sigue mandando hasta que llegue otro
  // `^FB`, asi que se guarda aqui igual que en la impresora y no se reinicia en cada `^FO`.
  let fb: { w: number; lineas: number; separacion: number; justify: "L" | "C" | "R" } | null = null;

  for (const raw of zpl.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("^XA") || line.startsWith("^XZ")) continue;
    if (line.startsWith("^PW") || line.startsWith("^LL") || line.startsWith("^LH")) continue;
    if (line.startsWith("^GFA")) continue;

    // El marco (`^GB`) antes no se dibujaba ni se midia: "ensuciaria la previsualizacion".
    // Eso era verdad cuando el marco era fijo y no habia nada que hacer con el, pero dejaba al
    // editor sin nada donde agarrar la mitad de la etiqueta. Ahora se dibuja en gris claro,
    // que se ve lo justo para moverlo sin que parezca parte del contenido, y se emite su caja
    // para que el editor lo pueda redimensionar.
    if (line.startsWith("^GB")) {
      const p = line.slice(3).split(",");
      const w = Number.parseInt(p[0] ?? "0", 10);
      const h = Number.parseInt(p[1] ?? "0", 10);
      const grosor = Number.parseInt(p[2] ?? "1", 10);
      const x0 = curX;
      const y0 = curY;
      marcoLine(x0, y0, x0 + w, y0, grosor, MARCO);
      marcoLine(x0, y0 + h, x0 + w, y0 + h, grosor, MARCO);
      marcoLine(x0, y0, x0, y0 + h, grosor, MARCO);
      marcoLine(x0 + w, y0, x0 + w, y0 + h, grosor, MARCO);
      cajas.push({ etiqueta: "marco", x0, y0, x1: x0 + w, y1: y0 + h, grosorDots: grosor });
      continue;
    }

    if (line.startsWith("^FO")) {
      const [x, y] = line.slice(3).split(",").map(Number);
      curX = x;
      curY = y;
      continue;
    }
    if (line.startsWith("^A0")) {
      const p = line.slice(3).split(",");
      fontH = Number.parseInt(p[1], 10);
      fontW = Number.parseInt(p[2], 10);
      continue;
    }
    if (line.startsWith("^FB")) {
      const p = line.slice(3).split(",");
      const w = Number.parseInt(p[0] ?? "0", 10);
      const lineas = Number.parseInt(p[1] ?? "1", 10);
      const separacion = Number.parseInt(p[2] ?? "0", 10);
      const j = p[3] ?? "L";
      fb = {
        w,
        lineas: Math.max(1, lineas),
        // ZPL usa el alto de la fuente como separacion entre lineas cuando el `^FB` lleva un 0
        // en ese campo, que es lo que emite `emit()`. Sin esto, un nombre a dos lineas se
        // dibujaria pegado a si mismo en la previsualizacion y separado en el papel.
        separacion: separacion > 0 ? separacion : 0,
        justify: j === "C" || j === "R" ? j : "L",
      };
      vLine(curX + w, curY, curY + fontH, FB);
      continue;
    }
    if (line.startsWith("^BY")) {
      byW = Number.parseInt(line.slice(3).split(",")[0], 10);
      continue;
    }
    if (line.startsWith("^BC") || line.startsWith("^BE")) {
      bcH = Number.parseInt(line.slice(3).split(",")[1], 10);
      symbology = line.startsWith("^BE") ? "ean13" : "code128";
      inBarcode = true;
      continue;
    }
    if (line.startsWith("^FD")) {
      const text = line.slice(3).replace(/\^FS$/, "");
      if (inBarcode) {
        datosImpresos = text;
        if (symbology === "ean13") drawEan13(text, curX, curY, bcH, byW);
        else drawCode128(text, curX, curY, bcH, byW);
        inBarcode = false;
        continue;
      }
      // El `^FB` manda sobre como se coloca el texto DENTRO de la caja. Antes se ignoraba y
      // todo se dibujaba en el borde izquierdo de la caja, que es un fallo de fondo del
      // render, no de la plantilla: en el papel la impresora centra y alinea a la derecha, y
      // aqui no. Con el layout de dos columnas eso hacia que la previa no cuadrase con el ZPL
      // justo en las dos zonas de las que mas depende el aspecto final, el nombre centrado y
      // el precio a la derecha.
      //
      // Y no es solo el `x`: el `^FB` tambien reparte el texto en varias lineas, asi que un
      // nombre que se parte en dos sale en dos lineas en el papel y aqui salia en una sola
      // con el ancho de las dos, rebasando la caja y el marco. Se reparte igual que lo
      // repartiria la impresora: por palabras, y partiendo la palabra si ella sola no cabe.
      const lineas = fb ? partirLineas(text, fontW, fb.w, fb.lineas) : [text];
      const separacion = fb ? (fb.separacion > 0 ? fb.separacion : fontH) : 0;

      lineas.forEach((trozo, i) => {
        const anchoTrozo = trozo.length * fontW;
        // Sin `^FB` no hay caja: el texto arranca donde dice el `^FO`.
        const cajaW = fb ? fb.w : anchoTrozo;
        const dx = fb
          ? fb.justify === "C"
            ? Math.round((cajaW - anchoTrozo) / 2)
            : fb.justify === "R"
              ? cajaW - anchoTrozo
              : 0
          : 0;
        const x = curX + dx;
        const y = curY + i * (fontH + separacion);
        const used = drawText(x, y, fontH, fontW, trozo, TEXT);
        const b = textBox(trozo, x, y, fontH, fontW);
        cajas.push({ etiqueta: "texto", texto: trozo, alto: fontH, anchoUsado: used, ...b });
        if (x + used > widthDots) {
          informe.push(`"${trozo}" SE PASA POR LA DERECHA (${x + used} > ${widthDots})`);
        }
        if (y + fontH > heightDots) {
          informe.push(`"${trozo}" SE PASA POR ABAJO (${y + fontH} > ${heightDots})`);
        }
      });
      continue;
    }
  }

  // ------------------------------------------------------------------ comprobaciones
  const bz = barcodeZoneOf(template) as BarcodeZone | undefined;
  const plan = bz ? planForZone(template, bz, data.barcode) : null;
  const anchoSimbolo = bz && plan ? symbolDots(bz, plan) : 0;
  const zonaQuieta = bz && plan ? quietZoneDots(template, bz, plan) : 0;

  return {
    png: encodePng(px, W, H),
    puntos: aPuntos(px, W, H, widthDots, heightDots),
    cajas,
    informe,
    symbology,
    datosImpresos,
    anchoSimbolo,
    zonaQuieta,
    pixelesLogo,
  };
}

/**
 * El lienzo RGB a un byte por dot: 0 con tinta, 255 sin ella.
 *
 * Baja de escala tomando el pixel mas oscuro de cada dot, no el promedio. El promedio
 * difuminaria justo lo que mas importa mirar: las barras de un codigo, que son de 1 a 3 dots,
 * se vuelven gris claro con un promedio y desaparecen en un dibujo de texto. El mas oscuro
 * mantiene el borde de la barra, que es lo que dice cuanto mide de verdad.
 */
function aPuntos(px: Buffer, W: number, H: number, anchoDots: number, altoDots: number): Buffer {
  const puntos = Buffer.alloc(anchoDots * altoDots, 255);
  const sx = W / anchoDots;
  const sy = H / altoDots;
  for (let y = 0; y < H; y++) {
    const dy = Math.min(altoDots - 1, Math.floor(y / sy));
    for (let x = 0; x < W; x++) {
      const dx = Math.min(anchoDots - 1, Math.floor(x / sx));
      const o = (y * W + x) * 3;
      const gris = Math.round((px[o] + px[o + 1] + px[o + 2]) / 3);
      const i = dy * anchoDots + dx;
      if (gris < puntos[i]) puntos[i] = gris;
    }
  }
  return puntos;
}

/** PNG RGB sin filtro, con la tabla CRC calculada una vez. */
export function encodePng(px: Buffer, W: number, H: number): Buffer {
  const stride = W * 3;
  const raw = Buffer.alloc((stride + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (stride + 1)] = 0;
    px.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });

  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  const crc32 = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, body: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const t = Buffer.from(type, "ascii");
    const cr = Buffer.alloc(4);
    cr.writeUInt32BE(crc32(Buffer.concat([t, body])));
    return Buffer.concat([len, t, body, cr]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}