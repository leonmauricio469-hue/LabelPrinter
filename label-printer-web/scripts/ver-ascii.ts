/**
 * La etiqueta en texto, para poder MIRARLA sin una imagen.
 *
 *   tsc -p tsconfig.preview.json
 *   node .preview-build/scripts/ver-ascii.js
 *   NOMBRE="..." BARCODE=... PRECIO=... node .preview-build/scripts/ver-ascii.js
 *
 * POR QUE ESTE SCRIPT Y NO ABRIR EL PNG
 *
 * `render-label.js` escribe un PNG exacto, que es lo que hay que mirar para judge el diseno de
 * verdad. Ese PNG no se puede leer desde una terminal ni desde este entorno, asi que aqui se
 * dibuja el MISMO `renderLabel()` con caracteres: cada caracter es un bloque de pixeles y `#` es
 * un bloque con tinta.
 *
 * Que sea el mismo `renderLabel()` y no un dibujo aparte es lo que lo hace valer: si este
 * cuadrito se ve bien, el PNG sale bien, porque salen de la misma funcion con el mismo ZPL. Un
 * dibujo propio seria una segunda verdad, y dos verdades siempre se contradicen en algun sitio.
 *
 * NO es una comprobacion: no falla nunca y no decide nada. Es el equivalent a mirar la etiqueta
 * en el papel, con la lupa, que es como se cazan las cosas que un test no ve.
 */

import { renderLabel } from "../src/lib/labels/label.render";
import { DEFAULT_TEMPLATE } from "../src/lib/labels/label.template";
import type { LabelData } from "../src/lib/labels/label.types";

const CASOS: Array<{ titulo: string; data: LabelData }> = [
  {
    titulo: "PRODUCTO DE PRUEBA, tal y como se pidio",
    data: {
      productName: process.env.NOMBRE ?? "TODO USO CHOCOLATE BITTER ST MORITZ 100 GR",
      barcode: process.env.BARCODE ?? "7591720033377",
      price: Number.parseFloat(process.env.PRECIO ?? "3"),
      reference: "0001",
      businessName: "PA PICAR",
    },
  },
  {
    titulo: "NOMBRE CORTO, precio corto",
    data: {
      productName: "ACEITE",
      barcode: "033844007522",
      price: 5.68,
      reference: "0001",
      businessName: "PA PICAR",
    },
  },
  {
    titulo: "NOMBRE LARGO DEL CATALOGO, que se parte en dos lineas",
    data: {
      productName: "BOMBONES DE CHOCOLATE SURTIDOS ST MORITZ 120 G PAQUETE X 24 UNIDADES",
      barcode: "7591720033377",
      price: 1234.56,
      reference: "0001",
      businessName: "PA PICAR",
    },
  },
  {
    titulo: "CODIGO INTERNO QUE NO CABE, sin barras",
    data: {
      productName: "PECHUGA DE POLLO CON AJO Y CEBOLLA FRITA",
      barcode: "XPROD20220002",
      price: 3,
      reference: "0002",
      businessName: "PA PICAR",
    },
  },
];

for (const { titulo, data } of CASOS) {
  const r = renderLabel(DEFAULT_TEMPLATE, data, { scale: 4, grid: false });
  const W = DEFAULT_TEMPLATE.widthDots;
  const H = DEFAULT_TEMPLATE.heightDots;

  console.log("=".repeat(104));
  console.log(titulo);
  console.log("=".repeat(104));

  // 4 dots de ancho por caracter y 8 de alto: es la proporcion de un caracter de terminal, y
  // sale un dibujo con la forma de la etiqueta y no una barra de texto. Con `scale: 4` cada
  // dot son 4 pixeles en el PNG y se promedian aqui, asi que una barra de modulo 3 sale de 3
  // caracteres de ancho y se ve como barra y no como ruido.
  const BX = 4;
  const BY = 8;
  for (let dy = 0; dy < H; dy += BY) {
    let linea = "";
    for (let dx = 0; dx < W; dx += BX) {
      let tinta = 0;
      let celdas = 0;
      for (let y = dy; y < Math.min(H, dy + BY); y++) {
        for (let x = dx; x < Math.min(W, dx + BX); x++) {
          celdas++;
          if (r.puntos[y * W + x] < 90) tinta++;
        }
      }
      const p = celdas === 0 ? 0 : tinta / celdas;
      linea += p > 0.5 ? "#" : p > 0.2 ? "+" : p > 0.04 ? "." : " ";
    }
    console.log(linea.replace(/\s+$/, ""));
  }

  console.log();
  for (const c of r.cajas) {
    const t = c.texto ?? c.etiqueta;
    console.log(`  ${String(c.y0).padStart(3)}..${String(c.y1).padStart(3)}  ${t}`);
  }
  console.log();
}
