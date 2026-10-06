/**
 * Volcado del layout real, para ver los avisos del detector de solapes uno a uno.
 *
 * No es una comprobacion: no falla nunca y no decide nada. Es el equivalent a mirar la
 * etiqueta impresa en el papel, pero en texto, que es lo que se puede hacer desde aqui.
 *
 *   tsc -p tsconfig.preview.json
 *   node .preview-build/scripts/ver-layout.js
 */
import { renderLabel } from "../src/lib/labels/label.render";
import { buscarProblemas } from "../src/lib/labels/label-solapes";
import { DEFAULT_TEMPLATE } from "../src/lib/labels/label.template";
import { foldField } from "../src/lib/labels/ascii.fold";
import { graphicDots } from "../src/lib/labels/gf-graphic";
import { symbolDots, planForZone, barcodeZoneOf } from "../src/lib/labels/zpl.builder";
import type { LabelData } from "../src/lib/labels/label.types";

const CASOS: Array<{ titulo: string; data: LabelData }> = [
  {
    titulo: "el producto de prueba pedido",
    data: {
      productName: "TODO USO CHOCOLATE BITTER ST MORITZ 100 GR",
      barcode: "7591720033377",
      price: 3.0,
      reference: "REF1",
      businessName: "PA PICAR",
    },
  },
  {
    titulo: "nombre corto, precio corto",
    data: {
      productName: "ACEITE",
      barcode: "033844007522",
      price: 5.68,
      reference: "REF1",
      businessName: "PA PICAR",
    },
  },
  {
    titulo: "nombre largo del catalogo (50 caracteres)",
    data: {
      productName: "BOMBONES DE CHOCOLATE SURTIDOS ST MORITZ 120 G PAQUETE X 24 UNIDADES",
      barcode: "7591720033377",
      price: 1234.56,
      reference: "REF-LARGO",
      businessName: "PA PICAR",
    },
  },
  {
    titulo: "codigo interno que no cabe (sin barras)",
    data: {
      productName: "PECHUGA DE POLLO CON AJO Y CEBOLLA FRITA",
      barcode: "XPROD20220002",
      price: 3.0,
      reference: "REF2",
      businessName: "PA PICAR",
    },
  },
];

const t = DEFAULT_TEMPLATE;
console.log(`${t.name}: ${t.widthDots} x ${t.heightDots} dots\n`);

for (const { titulo, data } of CASOS) {
  console.log("=".repeat(78));
  console.log(titulo);
  console.log("=".repeat(78));

  const plan = data.barcode ? planForZone(t, barcodeZoneOf(t)!, data.barcode) : null;
  if (plan && !plan.printable) console.log(`  SIN BARRAS: ${plan.reason}`);
  if (plan?.printable) {
    console.log(
      `  barras: ${plan.symbology} ${plan.modules} modulos a ${plan.moduleWidth} dots ` +
        `= ${plan.modules * plan.moduleWidth} dots`,
    );
  }

  const r = renderLabel(t, data);
  if (r.pixelesLogo === 0) console.log("  LOGO EN BLANCO");

  const cajas = [...r.cajas].sort((a, b) => a.y0 - b.y0);
  for (const c of cajas) {
    const ancho = c.x1 - c.x0;
    const alto = c.y1 - c.y0;
    console.log(
      `  y ${String(c.y0).padStart(3)}..${String(c.y1).padStart(3)}  ` +
        `${c.etiqueta.padEnd(26)} x ${String(c.x0).padStart(3)}..${String(c.x1).padStart(3)}` +
        `  (${ancho}x${alto})`,
    );
  }

  const avisos = buscarProblemas(r.cajas, t.widthDots, t.heightDots);
  console.log(avisos.length === 0 ? "  sin avisos" : "");
  for (const a of avisos) console.log(`  AVISO [${a.tipo}] ${a.mensaje}`);
  for (const w of r.informe) console.log(`  INFORME  ${w}`);
  console.log("");
}

// Lo que el "^FB" del nombre hace con el nombre del producto de prueba, que es lo que
// determina si sale grande o sale chiquito.
console.log("=".repeat(78));
console.log("AUTO-FIT DEL NOMBRE: a que alto sale cada longitud");
console.log("=".repeat(78));
console.log("  caracteres   alto que sale   ancho que ocupa");
for (const largo of [8, 15, 20, 27, 35, 40, 45, 50]) {
  const texto = "X".repeat(largo);
  const alto = resuelveAlto(texto, 446, 0.42, 56, 16);
  console.log(
    `  ${String(largo).padStart(9)}   ${String(alto).padStart(12)}   ${String(largo * Math.round(alto * 0.42)).padStart(13)}`,
  );
}

/** Copia de `resolveAutoFit()`, que es privado. */
function resuelveAlto(texto: string, caja: number, ratio: number, max: number, min: number): number {
  const n = texto.length;
  let alto = max;
  while (alto > min && n * Math.max(1, Math.round(alto * ratio)) > caja) alto -= 1;
  return alto;
}

// Un dato que conviene tener a mano: cuanto mide el nombre plegado a ASCII y en mayusculas.
console.log(`\nPLEGADO: "PECHUGA DE POLLO CON AJO Y CEBOLLA FRITA" -> "${foldField("PECHUGA DE POLLO CON AJO Y CEBOLLA FRITA")}"`);

// El peor caso de verdad: el nombre mas largo que hay en el catalogo, no uno inventado.
console.log("\n" + "=".repeat(78));
console.log("NOMBRE MAS LARGO DEL CATALOGO REAL, con la etiqueta tal y como esta");
console.log("=".repeat(78));
for (const largo of [40, 50, 60, 68, 80]) {
  const texto = "X".repeat(largo);
  const anchoCelda = (a: number) => Math.max(1, Math.round(a * 0.42));
  const caja = 446;
  const unaLinea = (a: number) => largo * anchoCelda(a) <= caja;
  let a1 = 56;
  while (a1 > 16 && !unaLinea(a1)) a1 -= 1;
  const lineas = (a: number) => Math.ceil(largo / Math.max(1, Math.floor(caja / anchoCelda(a))));
  const cabeEn = (a: number) => unaLinea(a) ? `1 linea a ${a} dots` : null;
  const conDos = (() => {
    let a = 56;
    while (a > 16 && lineas(a) > 2) a -= 1;
    return lineas(a) <= 2 ? `2 lineas a ${a} dots (bajo de ${a + 6} la letra ya no se lee de lejos)` : "no cabe ni en 2";
  })();
  console.log(
    `  ${String(largo).padStart(3)} car.   1 linea: ${String(cabeEn(a1) ?? `no cabe ni a 16 dots (${largo * anchoCelda(16)} de ${caja})`).padEnd(46)}   con 2: ${conDos}`,
  );
}
const logo = t.zones.find((z) => z.kind === "graphic");
if (logo && logo.kind === "graphic") {
  const d = graphicDots(logo.gf);
  console.log(`LOGO: ${d.dots?.w} x ${d.dots?.h} dots en (${logo.x}, ${logo.y})`);
}
const bz = barcodeZoneOf(t);
if (bz) {
  const plan = planForZone(t, bz, "7591720033377");
  if (plan.printable) {
    console.log(
      `BARRAS: ${symbolDots(bz, plan)} dots de simbolo, zona quieta ` +
        `${bz.moduleWidth * 10} a cada lado, columna ${bz.x}..${bz.x + symbolDots(bz, plan) + bz.moduleWidth * 20}`,
    );
  }
}