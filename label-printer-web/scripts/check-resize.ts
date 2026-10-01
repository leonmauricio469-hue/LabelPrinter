// Comprueba el redimensionado de zonas arrastrando.
//
//   tsc -p tsconfig.preview.json
//   node .preview-build/scripts/check-resize.js
//
// POR QUE UN TEST Y NO PROBAR A RATON
//
// `redimensionar()` decide que numero acaba en el ZPL. Un error de signo aqui mueve el marco o
// cambia el grosor de modulo en sentido contrario al que se ha arrastrado, y eso se ve
// moviendo el raton, que es lento, poco preciso, y no cubre los casos que de verdad rompen: el
// minimo, la proporcion del logo, y el ancho que el formato no admite.
import { redimensionar, ASIDERES, altoDeFuente, anchoDeFuente } from "../src/lib/labels/label.resize";
import { graphicDots } from "../src/lib/labels/gf-graphic";
import { LOGO_GF } from "../src/lib/labels/pa-picar-logo";
import type { BarcodeZone, GraphicZone, LabelZone, ShapeZone, TextZone } from "../src/lib/labels/label.template";

let pruebas = 0;
let fallos = 0;

function ok(nombre: string, cond: boolean, detalle = ""): void {
  pruebas++;
  if (cond) return;
  fallos++;
  console.log(`  FALLA  ${nombre}${detalle ? `  ->  ${detalle}` : ""}`);
}

function eq(nombre: string, obtenido: unknown, esperado: unknown): void {
  ok(nombre, obtenido === esperado, `obtenido ${JSON.stringify(obtenido)}, esperado ${JSON.stringify(esperado)}`);
}

const CTX = { modulos: 95 };

const marco = (patch: Partial<ShapeZone> = {}): ShapeZone => ({
  kind: "shape",
  x: 8,
  y: 8,
  widthDots: 456,
  heightDots: 264,
  thicknessDots: 3,
  ...patch,
});

const texto = (patch: Partial<TextZone> = {}): TextZone => ({
  kind: "text",
  x: 64,
  y: 92,
  format: "^A0N,54,27",
  source: "productName",
  maxWidthDots: 342,
  autoFit: { maxHeight: 54, minHeight: 13, widthRatio: 0.5 },
  ...patch,
});

const barras = (patch: Partial<BarcodeZone> = {}): BarcodeZone => ({
  kind: "barcode",
  x: 0,
  y: 150,
  heightDots: 64,
  interpretationLine: true,
  source: "barcode",
  center: true,
  moduleWidth: 3,
  hriHeightDots: 12,
  ...patch,
});

const logo = (patch: Partial<GraphicZone> = {}): GraphicZone => ({
  kind: "graphic",
  x: 136,
  y: 20,
  gf: LOGO_GF,
  ...patch,
});

// -------------------------------------------------------------------------- marco (shape)

console.log("Marco");
{
  // Tirar del borde derecho 20 dots ensancha 20 y no mueve la x.
  const r = redimensionar(marco(), "e", 20, 0, CTX) as ShapeZone;
  eq("borde derecho: ancho +20", r.widthDots, 476);
  eq("borde derecho: x quieta", r.x, 8);
  eq("borde derecho: alto quieto", r.heightDots, 264);

  // Tirar del borde IZQUIERDO 20 dots hacia la derecha: el borde se acerca, la caja se
  // estrecha y la x avanza para que el borde derecho no se mueva. Este es el que se suele
  // invertir sin querer, y el resultado es un marco que se encoge hacia la izquierda.
  const l = redimensionar(marco(), "w", 20, 0, CTX) as ShapeZone;
  eq("borde izquierdo: ancho -20", l.widthDots, 436);
  eq("borde izquierdo: x +20", l.x, 28);
  eq("borde izquierdo: lado derecho quieto", l.x + l.widthDots, 464);

  // Igual en vertical, y con las dos a la vez en una esquina.
  const s = redimensionar(marco(), "s", 0, 30, CTX) as ShapeZone;
  eq("borde abajo: alto +30", s.heightDots, 294);
  eq("borde abajo: y quieta", s.y, 8);
  const se = redimensionar(marco(), "se", -8, -12, CTX) as ShapeZone;
  eq("esquina: ancho -8", se.widthDots, 448);
  eq("esquina: alto -12", se.heightDots, 252);

  // El minimo: por debajo de 8 dots de ancho no hay marco, hay un punto. Con la esquina
  // abajo-derecha, asi que los dos ejes se mueven a la vez.
  const min = redimensionar(marco(), "se", -9999, -9999, CTX) as ShapeZone;
  eq("ancho minimo 8", min.widthDots, 8);
  eq("alto minimo 4", min.heightDots, 4);

  // Nunca coordenadas negativas: se salirian del rollo por la izquierda.
  const fuera = redimensionar(marco(), "nw", 400, 400, CTX) as ShapeZone;
  ok("x nunca negativa", fuera.x >= 0, `${fuera.x}`);
  ok("y nunca negativa", fuera.y >= 0, `${fuera.y}`);
}

// ------------------------------------------------------------------------- texto

console.log("Texto");
{
  // Vertical = alto de letra. Con `autoFit` eso es el techo.
  const v = redimensionar(texto(), "s", 0, 10, CTX) as TextZone;
  eq("abajo +10: techo 64", v.autoFit?.maxHeight, 64);
  eq("abajo +10: format acorde", v.format, "^A0N,64,32");
  eq("abajo +10: ancho de caja quieto", v.maxWidthDots, 342);
  eq("abajo +10: minHeight no se toca", v.autoFit?.minHeight, 13);

  // El borde SUPERIOR tambien mueve `y`, no solo encoge: si bajara el alto sin bajar `y`, la
  // caja se encogeria hacia arriba y la letra se pegaria al techo de la etiqueta.
  const a = redimensionar(texto(), "n", 0, 10, CTX) as TextZone;
  eq("arriba +10: techo baja a 44", a.autoFit?.maxHeight, 44);
  eq("arriba +10: y baja con el borde", a.y, 102);

  // Horizontal = ancho de caja `^FB`.
  const h = redimensionar(texto(), "e", 40, 0, CTX) as TextZone;
  eq("derecha +40: caja 382", h.maxWidthDots, 382);
  eq("derecha +40: alto quieto", h.autoFit?.maxHeight, 54);

  const i = redimensionar(texto(), "w", 40, 0, CTX) as TextZone;
  eq("izquierda +40: caja 302", i.maxWidthDots, 302);
  eq("izquierda +40: x avanza", i.x, 104);

  // Esquina: las dos cosas a la vez, y cada una por su lado.
  const c = redimensionar(texto(), "se", 24, -6, CTX) as TextZone;
  eq("esquina: caja 366", c.maxWidthDots, 366);
  eq("esquina: techo 48", c.autoFit?.maxHeight, 48);

  // Sin `autoFit` manda el `format`. El ancho de celda tiene que seguir al alto, o la letra
  // sale deforme, que es un fallo que en la etiqueta impresa parece "fuente rara".
  const fijo = texto({ autoFit: undefined, format: "^A0N,30,20", maxWidthDots: 300 });
  const fj = redimensionar(fijo, "s", 0, 10, CTX) as TextZone;
  eq("sin autoFit: alto 40", fj.format, "^A0N,40,27");
  eq("sin autoFit: altoDeFuente lo lee", altoDeFuente(fj), 40);
  eq("sin autoFit: anchoDeFuente lo lee", anchoDeFuente(fj), 27);

  // Sin `maxWidthDots` y sin medida del render no hay base: el alto se mueve y el ancho se
  // queda como estaba (es decir, ausente), en vez de inventarse un ancho.
  const sinCaja = texto({ maxWidthDots: undefined });
  const sc = redimensionar(sinCaja, "e", 40, 0, CTX) as TextZone;
  eq("sin ancho base no se inventa", sc.maxWidthDots, undefined);
  eq("pero el alto si se mueve", sc.autoFit?.maxHeight, 54);

  // Con la medida del render si hay base.
  const conCtx = redimensionar(sinCaja, "e", 40, 0, {
    ...CTX,
    anchoCajaTexto: 300,
  }) as TextZone;
  eq("con medida del render, caja 340", conCtx.maxWidthDots, 340);

  // El minimo de alto de letra.
  const min = redimensionar(texto(), "s", 0, -999, CTX) as TextZone;
  eq("alto de letra minimo 4", min.autoFit?.maxHeight, 4);
}

// -------------------------------------------------------------------------- barras

console.log("Codigo de barras");
{
  const v = redimensionar(barras(), "s", 0, 16, CTX) as BarcodeZone;
  eq("abajo +16: alto 80", v.heightDots, 80);
  eq("abajo +16: y quieta", v.y, 150);
  eq("abajo +16: moduleWidth quieto", v.moduleWidth, 3);

  const a = redimensionar(barras(), "n", 0, 10, CTX) as BarcodeZone;
  eq("arriba +10: alto 54", a.heightDots, 54);

  // Horizontal = ancho de modulo. Con 95 modulos, 285 dots de arrastre son 3 modulos.
  const h = redimensionar(barras(), "e", 285, 0, CTX) as BarcodeZone;
  eq("derecha +285: moduleWidth 6", h.moduleWidth, 6);
  // El ancho de las barras es un ESCALON, no un mando continuo: hacen falta 95 dots (un modulo
  // entero) para sumar uno. Con redondeo al mas proximo, 94 dots ya lo sumaban, que es
  // responder antes de tiempo y hace que el tirador parezca pegajoso.
  const h2 = redimensionar(barras(), "e", 95, 0, CTX);
  eq("derecha +95: un modulo entero", (h2 as BarcodeZone).moduleWidth, 4);
  const h3 = redimensionar(barras(), "e", 94, 0, CTX);
  eq("derecha +94: todavia 3, no llega al modulo", (h3 as BarcodeZone).moduleWidth, 3);
  const h4 = redimensionar(barras(), "e", 189, 0, CTX);
  eq("derecha +189: casi dos modulos, sigue en 4", (h4 as BarcodeZone).moduleWidth, 4);
  const h5 = redimensionar(barras(), "e", 190, 0, CTX);
  eq("derecha +190: dos modulos", (h5 as BarcodeZone).moduleWidth, 5);
  // Y al encoger tambien hace falta el modulo completo. Ojo con la direccion: tirar del borde
  // IZQUIERDO hacia la IZQUIERDA agranda la caja (la arista se aleja del centro) y hacia la
  // DERECHA la encoge. Se mueve la arista, no el sentido del raton.
  const h6 = redimensionar(barras({ moduleWidth: 3 }), "w", 95, 0, CTX);
  eq("izquierda +95 (hacia dentro): un modulo menos", (h6 as BarcodeZone).moduleWidth, 2);
  const h7 = redimensionar(barras({ moduleWidth: 3 }), "w", 94, 0, CTX);
  eq("izquierda +94: sigue en 3", (h7 as BarcodeZone).moduleWidth, 3);
  const h8 = redimensionar(barras({ moduleWidth: 3 }), "w", -95, 0, CTX);
  eq("izquierda -95 (hacia fuera): un modulo mas", (h8 as BarcodeZone).moduleWidth, 4);
  const h9 = redimensionar(barras({ moduleWidth: 3 }), "w", -94, 0, CTX);
  eq("izquierda -94: sigue en 3", (h9 as BarcodeZone).moduleWidth, 3);

  // El minimo y el maximo del ancho de modulo.
  const max = redimensionar(barras(), "e", 9999, 0, CTX) as BarcodeZone;
  eq("modulo maximo 10", max.moduleWidth, 10);
  const min = redimensionar(barras(), "e", -9999, 0, CTX) as BarcodeZone;
  eq("modulo minimo 1", min.moduleWidth, 1);
  const hmin = redimensionar(barras(), "s", 0, -9999, CTX) as BarcodeZone;
  eq("alto de barra minimo 10", hmin.heightDots, 10);

  // Con `center` la x no se toca: `barcodeX()` recentra el simbolo y una x cambiada haria que
  // la caja del editor se moviese mientras el simbolo se queda quieto.
  const cen = redimensionar(barras(), "e", 200, 0, CTX) as BarcodeZone;
  eq("centrada: x intacta", cen.x, 0);

  // Sin `center` la x si manda.
  const nocen = redimensionar(barras({ center: false, x: 40 }), "e", 200, 0, CTX) as BarcodeZone;
  eq("sin centrar: x quieta al tirar del borde derecho", nocen.x, 40);
  const nocen2 = redimensionar(barras({ center: false, x: 40 }), "w", 20, 0, CTX) as BarcodeZone;
  eq("sin centrar: x avanza con el borde izquierdo", nocen2.x, 60);
}

// -------------------------------------------------------------------------- logo

console.log("Logo");
{
  const antes = graphicDots(LOGO_GF).dots!;
  eq("medida de partida", `${antes.w}x${antes.h}`, "200x67");

  // Tirar 80 dots a la derecha: ancho 280, y el alto sube proporcionalmente a 94. Si el alto
  // se quedara en 67 el logo saldra aplastado, que es un logo deformado.
  const r = redimensionar(logo(), "e", 80, 0, CTX) as GraphicZone;
  const d = graphicDots(r.gf).dots!;
  eq("ancho 280", d.w, 280);
  eq("alto proporcional 94", d.h, 94);
  eq("x quieta", r.x, 136);

  // Tirar en vertical: la altura manda y el ancho LE SIGUE, o sea que el logo crece y no se
  // estira. El ancho sale del factor, y el factor sale del alto pedido: 67 + 27 = 94, luego
  // 200 * 94/67 = 280,6, que `^GFA` no admite (no es multiplo de 8) y se queda en 280.
  const v = redimensionar(logo(), "s", 0, 27, CTX) as GraphicZone;
  const dv = graphicDots(v.gf).dots!;
  eq("abajo +27: alto 94", dv.h, 94);
  eq("abajo +27: ancho proporcional 280", dv.w, 280);

  // Un ancho pedido que no es multiplo de 8 se ajusta al MAS CERCANO, no al siguiente. Pedir
  // 100 y quedarse en 104 suma 4 dots de golpe; pedir 104 no suma nada. La proporcion se
  // calcula sobre el ancho YA ajustado, que si no acumularia el error dos veces.
  const disp = redimensionar(logo(), "e", -96, 0, CTX) as GraphicZone;
  const dd = graphicDots(disp.gf).dots!;
  eq("ancho pedido 104 se queda en 104", dd.w, 104);

  // La proporcion se mantiene siempre: 280/94 y 200/67 son los mismos 2,985.
  const propOk = (z: GraphicZone) => {
    const m = graphicDots(z.gf).dots!;
    return Math.abs(m.w / m.h - antes.w / antes.h) < 0.02;
  };
  ok("proporcion intacta agrandando", propOk(r));
  ok("proporcion intacta en vertical", propOk(v));

  // Encoger mucho y luego mucho mas: se queda en el minimo, sin romper.
  const pequeno = redimensionar(logo(), "se", -9999, -9999, CTX) as GraphicZone;
  const dp = graphicDots(pequeno.gf).dots!;
  ok("no se puede encoger de vacio", dp.w >= 8 && dp.h >= 4, `${dp.w}x${dp.h}`);

  // Un `^GF` ilegible no debe dejar la zona a medias.
  const roto = logo({ gf: "esto no es un ^GFA" });
  const r2 = redimensionar(roto, "e", 40, 0, CTX) as GraphicZone;
  eq("con ^GF ilegible no cambia nada", r2.gf, roto.gf);
  eq("ni se mueve la posicion", r2.x, 136);
}

// ------------------------------------------------------------------ las ocho asas

console.log("Las ocho asas tocan la zona");
{
  for (const a of ASIDERES) {
    const r = redimensionar(marco(), a, 10, 10, CTX) as ShapeZone;
    ok(
      `asa ${a} cambia algo`,
      r.widthDots !== 456 || r.heightDots !== 264 || r.x !== 8 || r.y !== 8,
      `${r.x},${r.y} ${r.widthDots}x${r.heightDots}`,
    );
  }
  // Cero desplazamiento no cambia nada: es lo que pasa al pulsar y soltar sin mover, y si
  // cambiara un numero solo porASI seria la clase de cambio que nadie puede reproducir.
  const quieto = redimensionar(marco(), "se", 0, 0, CTX) as ShapeZone;
  eq("sin arrastre no cambia", `${quieto.x},${quieto.y},${quieto.widthDots},${quieto.heightDots}`, "8,8,456,264");
}

// ------------------------------------------------------------------ otras zonas

console.log("Zonas que no son de las cuatro");
{
  // Tipos que no llegan desde el navegador (el esquema no los tiene) no deben romper nada.
  const raro: LabelZone = { kind: "desconocido", x: 0, y: 0 } as unknown as LabelZone;
  const r = redimensionar(raro, "e", 10, 0, CTX);
  eq("tipo desconocido: sin cambios", JSON.stringify(r), JSON.stringify(raro));
}

console.log(`\n${pruebas} comprobaciones, ${fallos} fallos`);
if (fallos > 0) {
  console.log("HAY FALLOS");
  process.exit(1);
}
console.log("Las ocho asas mueven y redimensionan lo que toca, sin deformar nada.");
