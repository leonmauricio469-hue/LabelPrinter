// Comprueba la geometria del marco de seleccion del editor.
//
//   tsc -p tsconfig.preview.json
//   node .preview-build/scripts/check-marco.js
//
// POR QUE ESTE TEST
//
// El marco es lo que el usuario arrastra: si se equivoca en un borde, el puntero y la caja
// se separan y el editor se siente "roto" aunque `redimensionar()` este en lo correcto. Las
// dos mitades tienen que compartir minimos y sentidos, y esto comprueba exactamente eso:
// que la estimacion apunte donde apunta el render y que el estirado siga al puntero sin
// bajar de los minimos de `label.resize`.
import { cajaEstimada, desplazarMarco, estirarMarco, type Marco } from "../src/lib/labels/label.marco";
import { MIN_DOTS } from "../src/lib/labels/label.resize";
import { LOGO_GF } from "../src/lib/labels/pa-picar-logo";
import type { BarcodeZone, GraphicZone, TextZone, TextZoneData } from "../src/lib/labels/label.template";

let pruebas = 0;
let fallos = 0;

function ok(nombre: string, cond: boolean, detalle = ""): void {
  pruebas++;
  if (cond) return;
  fallos++;
  console.log(`  FALLA  ${nombre}${detalle ? `  ->  ${detalle}` : ""}`);
}

function eq(nombre: string, obtenido: unknown, esperado: unknown): void {
  ok(
    nombre,
    obtenido === esperado,
    `obtenido ${JSON.stringify(obtenido)}, esperado ${JSON.stringify(esperado)}`,
  );
}

const caja = (m: Marco | null): string =>
  m ? `${m.x0},${m.y0},${m.x1},${m.y1}` : "null";

const CTX = { anchoSimbolo: 0 };

const texto = (patch: Partial<TextZoneData> = {}): TextZone => ({
  kind: "text",
  x: 13,
  y: 72,
  format: "^A0N,56,24",
  source: "productName",
  maxWidthDots: 446,
  maxLines: 2,
  justify: "C",
  ...patch,
});

const barras = (patch: Partial<BarcodeZone> = {}): BarcodeZone => ({
  kind: "barcode",
  x: 40,
  y: 168,
  heightDots: 75,
  interpretationLine: true,
  source: "barcode",
  center: false,
  moduleWidth: 3,
  hriHeightDots: 12,
  ...patch,
});

// ------------------------------------------------------------------ caja estimada: texto

console.log("Caja estimada de texto");
{
  // Una linea: el marco es la caja `^FB` entera (x..x+maxWidthDots) y de alto una letra.
  // El texto va centrado DENTRO, como en la impresora, y por eso el marco es mas ancho que
  // el texto impreso.
  const m = cajaEstimada(texto(), {
    ...CTX,
    texto: "PA PICAR",
    altoLetra: 56,
    anchoCelda: 24,
  });
  eq("una linea: caja completa", caja(m), "13,72,459,128");

  // Texto largo que se parte en dos lineas: alto de bloque = 2*alto + 1*separacion, con la
  // separacion igual al alto de la fuente (lo que hace la impresora con `^FB` y separacion 0).
  const dos = cajaEstimada(texto(), {
    ...CTX,
    texto: "BOMBONES RICOS ARANDANO Y FRESA PACO 100G",
    altoLetra: 28,
    anchoCelda: 12,
  });
  // 41 chars * 12 = 492 > 446 -> dos lineas -> bloque = 3 * 28 = 84.
  eq("dos lineas: bloque 3*alto", caja(dos), "13,72,459,156");

  // `maxLines` es techo: con 3 lineas posibles pero tope en 2, el marco no se inventa una
  // tercera.
  const tope = cajaEstimada(texto({ maxLines: 1 }), {
    ...CTX,
    texto: "BOMBONES RICOS ARANDANO Y FRESA PACO 100G",
    altoLetra: 28,
    anchoCelda: 12,
  });
  eq("maxLines 1: una sola linea", caja(tope), "13,72,459,100");

  // Sin medida resuelta (aun no hay render) se lee el alto de la zona y se asume una linea:
  // el marco existe desde el primer pintado, que es de donde sale el arrastre.
  const sinRender = cajaEstimada(texto({ autoFit: { maxHeight: 40, minHeight: 16, widthRatio: 0.42 } }), CTX);
  eq("sin render: alto de la zona", caja(sinRender), "13,72,459,112");

  // Sin `maxWidthDots`, la caja es lo que ocupa el texto.
  const sinCaja = cajaEstimada(texto({ maxWidthDots: undefined }), {
    ...CTX,
    texto: "REF:",
    altoLetra: 20,
    anchoCelda: 10,
  });
  eq("sin maxWidthDots: ancho del texto", caja(sinCaja), "13,72,53,92");
}

// ---------------------------------------------------------------- caja estimada: barras

console.log("Caja estimada de barras");
{
  // La caja del render mete la linea de interpretacion dentro: el marco tiene que medir lo
  // mismo o arrastrar por abajo dejaria la linea fuera.
  const m = cajaEstimada(barras(), { ...CTX, anchoSimbolo: 285 });
  eq("simbolo + HRI", caja(m), "40,168,325,255");

  // Sin linea de interpretacion no se suma nada.
  const s = cajaEstimada(barras({ interpretationLine: false }), { ...CTX, anchoSimbolo: 285 });
  eq("sin HRI", caja(s), "40,168,325,243");

  // Sin render todavia se estima con 95 modulos (EAN-13), que es el caso del diseno.
  const e = cajaEstimada(barras(), CTX);
  eq("sin ancho de simbolo: 95 modulos", caja(e), "40,168,325,255");
}

// ---------------------------------------------------------------- caja estimada: logo/marco

console.log("Caja estimada de logo y marco");
{
  const logo: GraphicZone = { kind: "graphic", x: 156, y: 10, gf: LOGO_GF };
  const m = cajaEstimada(logo, CTX);
  eq("logo: mide su ^GFA", caja(m), "156,10,356,77");

  const roto = cajaEstimada({ ...logo, gf: "esto no es un ^GFA" }, CTX);
  eq("gf ilegible: sin marco", roto, null);

  const marco = cajaEstimada(
    { kind: "shape", x: 10, y: 8, widthDots: 452, heightDots: 264, thicknessDots: 1 },
    CTX,
  );
  eq("marco: la zona ES el rectangulo", caja(marco), "10,8,462,272");
}

// ------------------------------------------------------------------------- desplazar

console.log("Desplazar");
{
  const base: Marco = { x0: 10, y0: 20, x1: 110, y1: 70 };
  eq("traslado puro", caja(desplazarMarco(base, 15, -5)), "25,15,125,65");
  eq("cero no mueve", caja(desplazarMarco(base, 0, 0)), "10,20,110,70");
  eq("negativo", caja(desplazarMarco(base, -10, -20)), "0,0,100,50");
}

// ------------------------------------------------------------------------- estirar

console.log("Estirar");
{
  const base: Marco = { x0: 10, y0: 20, x1: 110, y1: 70 };
  const lim = { minAncho: MIN_DOTS.ancho, minAlto: MIN_DOTS.alto };

  // Borde derecho: la x quieta y el ancho sigue al puntero.
  eq("derecha +30", caja(estirarMarco(base, "e", 30, 0, lim)), "10,20,140,70");
  // Borde izquierdo: la arista izquierda avanza y la derecha no se mueve.
  eq("izquierda +30", caja(estirarMarco(base, "w", 30, 0, lim)), "40,20,110,70");
  eq("izquierda -20 (se aleja)", caja(estirarMarco(base, "w", -20, 0, lim)), "0,20,110,70");
  // Arriba mueve la y; abajo mueve el alto.
  eq("arriba +10", caja(estirarMarco(base, "n", 0, 10, lim)), "10,30,110,70");
  eq("abajo +10", caja(estirarMarco(base, "s", 0, 10, lim)), "10,20,110,80");
  // Esquina: los dos ejes a la vez, cada uno por su lado.
  eq("esquina se", caja(estirarMarco(base, "se", 20, 15, lim)), "10,20,130,85");

  // Minimos: nunca por debajo de `MIN_DOTS`, y con la misma base que `redimensionar()`.
  const minAncho = estirarMarco(base, "e", -9999, 0, lim);
  eq("ancho minimo", minAncho.x1 - minAncho.x0, MIN_DOTS.ancho);
  const minAlto = estirarMarco(base, "s", 0, -9999, lim);
  eq("alto minimo", minAlto.y1 - minAlto.y0, MIN_DOTS.alto);

  // Barras: el minimo de alto es el de barra (10), no el generico (4). Si el marco dejara
  // bajar a 4, al soltar la zona volveria a 10 y el marco saltaria solo.
  const limBarra = { minAncho: MIN_DOTS.ancho, minAlto: MIN_DOTS.altoBarra };
  const barraMin = estirarMarco(base, "s", 0, -9999, limBarra);
  eq("alto minimo de barra", barraMin.y1 - barraMin.y0, MIN_DOTS.altoBarra);

  // El borde izquierdo nunca pasa de cero: una posicion negativa se sale del rollo.
  const fuera = estirarMarco(base, "nw", -9999, -9999, lim);
  ok("x0 nunca negativa", fuera.x0 >= 0, `${fuera.x0}`);
  ok("y0 nunca negativa", fuera.y0 >= 0, `${fuera.y0}`);

  // Por la derecha si que se puede salir: eso lo juzga `buscarProblemas()`, y cortar el
  // puntero aqui haria que el raton y la caja se separaran sin aviso.
  const sale = estirarMarco(base, "e", 9999, 0, lim);
  ok("por la derecha se puede salir", sale.x1 > 110, `${sale.x1}`);

  // Cero de arrastre no cambia nada: es pulsar y soltar sin mover.
  eq("sin arrastre no cambia", caja(estirarMarco(base, "se", 0, 0, lim)), "10,20,110,70");
}

console.log(`\n${pruebas} comprobaciones, ${fallos} fallos`);
if (fallos > 0) {
  console.log("HAY FALLOS");
  process.exit(1);
}
console.log("El marco apunta donde apunta la zona y sigue al puntero sin romper nada.");
