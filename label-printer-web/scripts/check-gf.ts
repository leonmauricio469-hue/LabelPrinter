// Comprueba la lectura y el reescalado de `^GFA`.
//
//   tsc -p tsconfig.preview.json
//   node .preview-build/scripts/check-gf.js
//
// POR QUE HAY UN TEST Y NO UNA COMPROBACION A OJO
//
// El reescalado del logo reescribe el bitmap que va a la impresora. Un error aqui no da error
// de TypeScript ni de compilacion: da un logo con un pixel movido, o peor, un logo en blanco, y
// eso solo se ve gastando papel. La cabecera del `^GFA` es ademas el unico sitio donde vive
// el tamano, asi que un byte de mas o de menos cambia la medida que cree todo lo demas.
import { graphicDots, scaleGraphic, anchoEfectivo } from "../src/lib/labels/gf-graphic";
import { LOGO_GF, LOGO_DOTS_W, LOGO_DOTS_H } from "../src/lib/labels/pa-picar-logo";
import { renderLabel } from "../src/lib/labels/label.render";
import { DEFAULT_TEMPLATE } from "../src/lib/labels/label.template";

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

/**
 * Construye un `^GFA` con los pixeles indicados.
 *
 * `puntos` son coordenadas en dots. Sirve para tener una referencia conocida a mano en vez de
 * comprobar el reescalado contra si mismo, que es como un test de redondeo acaba pasando sin
 * comprobar nada.
 */
function gfaDePuntos(
  ancho: number,
  alto: number,
  puntos: Array<[number, number]>,
): string {
  const bpr = Math.ceil(ancho / 8);
  const buf = new Array<number>(bpr * alto).fill(0);
  for (const [x, y] of puntos) {
    buf[y * bpr + (x >> 3)] |= 1 << (7 - (x & 7));
  }
  const filas: string[] = [];
  for (let y = 0; y < alto; y++) {
    let fila = "";
    for (let b = 0; b < bpr; b++) fila += buf[y * bpr + b].toString(16).toUpperCase().padStart(2, "0");
    filas.push(fila);
  }
  return `^GFA,${bpr * alto},${bpr * alto},${bpr},${filas.join("\n")}`;
}

/** Puntos encendidos de un `^GFA`, para comparar antes y despues de reescalar. */
function puntosDe(gf: string): Set<string> {
  const { dots } = graphicDots(gf);
  const cab = /^(\^GF)([A-Z]),(\d+),(\d+),(\d+),/.exec(gf);
  if (!cab || !dots) return new Set();
  const bpr = Number.parseInt(cab[5], 10);
  const hex = gf.slice(cab[0].length).replace(/[^0-9a-fA-F]/g, "");
  const bytes: number[] = [];
  for (let i = 0; i + 1 < hex.length; i += 2) bytes.push(Number.parseInt(hex.slice(i, i + 2), 16));
  const fuera = new Set<string>();
  for (let y = 0; y < dots.h; y++) {
    for (let x = 0; x < dots.w; x++) {
      const b = bytes[y * bpr + (x >> 3)];
      if (b !== undefined && b & (1 << (7 - (x & 7)))) fuera.add(`${x},${y}`);
    }
  }
  return fuera;
}

// ----------------------------------------------------------------- medida del logo real

console.log("Medida del logo real");
{
  const { dots, fallo } = graphicDots(LOGO_GF);
  ok("el logo real se puede medir", fallo === null && dots !== null, fallo ?? "");
  eq("ancho del logo", dots?.w, LOGO_DOTS_W);
  eq("alto del logo", dots?.h, LOGO_DOTS_H);
  // Las constantes se quedan, pero ya no son la verdad. Si `generate-logo.ps1` regenera el
  // logo, este test salta y obliga a mirarlo, en vez de que el resto mida con un numero viejo.
  eq("ancho efectivo", anchoEfectivo(LOGO_GF), 200);
}

// ------------------------------------------------------------------- reescalado a la misma

console.log("Reescalar al mismo tamano no cambia nada");
{
  const r = scaleGraphic(LOGO_GF, 200, 67);
  if ("error" in r) {
    ok("no falla al reescalar al mismo tamano", false, r.error);
  } else {
    eq("medida conservada", `${r.dots.w}x${r.dots.h}`, "200x67");
    ok("cabecera conservada", r.gf.startsWith("^GFA,1675,1675,25,"), r.gf.slice(0, 22));
    const antes = puntosDe(LOGO_GF);
    const despues = puntosDe(r.gf);
    eq("mismo numero de puntos", despues.size, antes.size);
    let iguales = true;
    for (const p of antes) if (!despues.has(p)) iguales = false;
    ok("mismos pixeles en el mismo sitio", iguales);
  }
}

// ------------------------------------------------------------------ reescalado a otras

console.log("Reescalado a otras medidas");
{
  // Mas grande. 280 dots son 35,1 mm, que es el ancho pedido para el logo. 280 es multiplo de
  // 8, asi que aqui no hay ajuste y el ancho pedido y el real coinciden.
  const r = scaleGraphic(LOGO_GF, 280, 94);
  if ("error" in r) {
    ok("no falla al agrandar", false, r.error);
  } else {
    eq("ancho pedido 280", r.dots.w, 280);
    eq("alto pedido 94", r.dots.h, 94);
    eq("no hubo ajuste de ancho", r.pedido.w, r.dots.w);
    // 280/8 = 35 bytes por fila, 35 * 94 = 3290 bytes.
    ok("cabecera coherente", r.gf.startsWith("^GFA,3290,3290,35,"), r.gf.slice(0, 22));
    eq("numero de filas", r.gf.split("\n").length, 94);
    const antes = puntosDe(LOGO_GF).size;
    const despues = puntosDe(r.gf).size;
    // Vecino mas proximo: al agrandar 1,4x el area crece 1,96x, pero el borde del logo es
    // irregular, asi que se tolera un margen ancho. Solo se busca que no se pierda el dibujo.
    ok("el negro crece al agrandar", despues > antes, `${antes} -> ${despues}`);
    ok("no se desborda la relacion de area", despues < antes * 2.6, `${antes} -> ${despues}`);
  }

  // Mas pequeno, a la mitad. 100 dots NO existen: el ancho se ajusta al multiplo de 8 mas
  // cercano por encima, 104 (13 bytes). Este es el comportamiento que hay que fijar, porque
  // dibujar 100 dots de tinta y medir 104 haria que el comprobador de solapes contour 4 dots
  // de mas en cada etiqueta.
  const r2 = scaleGraphic(LOGO_GF, 100, 34);
  if ("error" in r2) {
    ok("no falla al encoger", false, r2.error);
  } else {
    eq("ancho pedido 100 se ajusta a 104", r2.dots.w, 104);
    eq("lo pedido se informa aparte", r2.pedido.w, 100);
    ok("cabecera coherente", r2.gf.startsWith("^GFA,442,442,13,"), r2.gf.slice(0, 20));
    // La tinta tiene que ocupar la MISMA proporcion del lienzo, no el ancho entero. El logo
    // no llega a los bordes: su tinta va de x=6 a x=196 en un lienzo de 200, y al encoger a
    // 104 dots el extremo derecho cae en 196 * 104/200 = 101. Pedir que llegue al dot 103
    // seria medir un lienzo que nadie dibujo.
    const p = puntosDe(r2.gf);
    let der = -1;
    for (const pt of p) {
      const x = Number.parseInt(pt.split(",")[0], 10);
      if (x > der) der = x;
    }
    const derEsperado = Math.floor(196 * (r2.dots.w / 200));
    ok("el extremo derecho cae donde toca", Math.abs(der - derEsperado) <= 1, `${der} vs ${derEsperado}`);
    ok("el negro mengua al encoger", p.size < puntosDe(LOGO_GF).size);
    ok("sigue habiendo dibujo", p.size > 100);
  }
}

// ------------------------------------------------------- pixeles exactos, sin ambiguedad

console.log("Pixeles exactos");
{
  // Un punto en (3, 2) de un lienzo de 16 x 8. Al ampliar x4 sale un bloque de 4 x 4.
  const uno = gfaDePuntos(16, 8, [[3, 2]]);
  eq("un punto mide 16x8", `${graphicDots(uno).dots?.w}x${graphicDots(uno).dots?.h}`, "16x8");

  const r = scaleGraphic(uno, 64, 32);
  if ("error" in r) {
    ok("no falla al ampliar 4x", false, r.error);
  } else {
    const p = puntosDe(r.gf);
    // x destino = floor(3 * 64/16) = 12..15, y = floor(2*32/8) = 8..11.
    eq("el punto son 16 pixeles", p.size, 16);
    let todos = true;
    for (let y = 8; y < 12; y++) for (let x = 12; x < 16; x++) if (!p.has(`${x},${y}`)) todos = false;
    ok("y estan en el bloque que toca", todos, [...p].slice(0, 4).join(" "));
  }

  // Al reducir, un punto de 4x4 debe seguir dejando al menos un pixel: es lo que distingue
  // "encoger" de "borrar".
  const cuatro = gfaDePuntos(16, 8, [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ]);
  const pequeno = scaleGraphic(cuatro, 8, 4);
  if ("error" in pequeno) {
    ok("no falla al reducir 2x", false, pequeno.error);
  } else {
    ok("un bloque 2x2 no desaparece al reducir", puntosDe(pequeno.gf).size >= 1);
  }
}

// --------------------------------------------------------------------- medidas invalidas

console.log("Medidas que no tienen sentido");
{
  const r = scaleGraphic(LOGO_GF, 4, 2);
  ok("rechaza 4x2, que es un punto", "error" in r, JSON.stringify(r));
  const r2 = scaleGraphic(LOGO_GF, 0, 0);
  ok("rechaza 0x0", "error" in r2);
  const r3 = scaleGraphic(LOGO_GF, 5000, 10);
  ok("rechaza 5000 de ancho", "error" in r3);
  const r4 = scaleGraphic("^GD,10,10,10,B,FF", 100, 10);
  ok("rechaza algo que no es ^GFA", "error" in r4);
  const roto = graphicDots("no es un campo grafico");
  ok("avisa si no se puede medir", roto.dots === null && roto.fallo !== null);
}

// ------------------------------------------------------------------------- separadores

console.log("Separadores");
{
  const conComa = gfaDePuntos(8, 2, [[0, 0]]).replace(/\n/g, ",");
  const { dots } = graphicDots(conComa);
  eq("lee tambien con comas", `${dots?.w}x${dots?.h}`, "8x2");
  const r = scaleGraphic(conComa, 16, 4);
  if (!("error" in r)) {
    ok("devuelve con comas si las traia", r.gf.includes(","), r.gf.slice(0, 40));
    eq("medida tras reescalar con comas", `${r.dots.w}x${r.dots.h}`, "16x4");
  }
}

// ------------------------------------------------------------ el logo sale en el render

console.log("El logo llega a la previsualizacion");
{
  // ESTO FUE UN FALLO REAL, NO UN EJERCICIO.
  //
  // `renderLabel()` sacaba el `^GFA` del ZPL con `zpl.match(/\^GFA,[\s\S]*?\n\^FS/)`. El
  // payload del logo trae saltos de linea, y el "`\n^FS`" que cerraba el patron era en
  // realidad el `^FS` del primer texto que hubiera despues. Funcionaba por casualidad, con el
  // separador que por entonces traia el logo generado.
  //
  // En cuanto el editor reescalaba el logo, `scaleGraphic()` reescribia el separador, el regex
  // dejaba de casar, y el logo se iba de la previsualizacion SIN NINGUN ERROR: la caja
  // desaparecia, el editor dejaba de marcarlo, y el logo de la pantalla no era el del ZPL.
  // Un fallo que sale de un fallo, y que no se ve en el papel sino en que una caja no esta.
  //
  // Lo que se comprueba aqui es el efecto, no el codigo: tras reescalar, el render tiene que
  // seguir teniendo caja de logo, y tiene que medir lo que dice el `^GFA`.
  const data = {
    productName: "BADIA JALAPEÑO 2 OZ",
    barcode: "033844007522",
    price: 5.68,
    reference: "RETAIL",
    businessName: "PA PICAR",
  };
  const conLogo = (gf: string) => ({
    ...DEFAULT_TEMPLATE,
    zones: DEFAULT_TEMPLATE.zones.map((z) => (z.kind === "graphic" ? { ...z, gf } : z)),
  });

  const original = renderLabel(conLogo(LOGO_GF), data, { scale: 1, grid: false });
  const cajaOriginal = original.cajas.find((c) => c.etiqueta === "logo");
  ok("con el logo tal cual hay caja", cajaOriginal !== undefined);
  eq("y mide 200x67", cajaOriginal ? `${cajaOriginal.x1 - cajaOriginal.x0}x${cajaOriginal.y1 - cajaOriginal.y0}` : "", "200x67");
  // Lo que de verdad importa: que haya tinta. Una caja con un rectangulo vacio dentro es el
  // fallo que no se ve mirando el numero de cajas.
  ok("y se dibuja con tinta", original.pixelesLogo > 1000, `${original.pixelesLogo} pixeles`);

  // El caso que se rompio: logo reescalado.
  const r = scaleGraphic(LOGO_GF, 224, 75);
  if ("error" in r) {
    ok("se puede reescalar para la prueba", false, r.error);
  } else {
    const escalado = renderLabel(conLogo(r.gf), data, { scale: 1, grid: false });
    const caja = escalado.cajas.find((c) => c.etiqueta === "logo");
    ok("tras reescalar sigue habiendo caja de logo", caja !== undefined);
    eq("y ahora mide 224x75", caja ? `${caja.x1 - caja.x0}x${caja.y1 - caja.y0}` : "", "224x75");
    ok("el informe lo dice", escalado.informe.some((l) => l.includes("logo 224 x 75 dots")));
    ok("y no protesta de que no se dibuje", !escalado.informe.some((l) => l.includes("NO DIBUJADO")));
    ok("y reescalado sigue teniendo tinta", escalado.pixelesLogo > 1000, `${escalado.pixelesLogo} pixeles`);
    // Agrandar 1,12x en cada lado da 1,25x de area. La tinta tiene que crecer en la misma
    // proporcion aproximada: mucho mas seria que se duplica el dibujo, mucho menos que se ha
    // comido media imagen.
    const esperado = Math.round((original.pixelesLogo * 224 * 75) / (200 * 67));
    ok(
      "la tinta crece como el area",
      escalado.pixelesLogo > esperado * 0.7 && escalado.pixelesLogo < esperado * 1.35,
      `${escalado.pixelesLogo} pixeles, esperado ~${esperado}`,
    );
  }

  // Un `^GFA` con la cabecera correcta pero todo el payload a cero: entra en el ZPL, asi que el
  // arreglo anterior lo daria por bueno, y sale una etiqueta con un rectangulo vacio donde
  // deberia ir el logo. Tiene que saltar en el informe.
  const cab = /^(\^GFA),\d+,\d+,(\d+),/.exec(LOGO_GF);
  if (cab) {
    const bytes = Number.parseInt(cab[2], 10) * 67;
    const vacio = `${cab[1]},${bytes},${bytes},${cab[2]},${"0".repeat(bytes * 2)}`;
    const enBlanco = renderLabel(conLogo(vacio), data, { scale: 1, grid: false });
    eq("un ^GFA vacio no pinta nada", enBlanco.pixelesLogo, 0);
    ok("y se avisa de que sale en blanco", enBlanco.informe.some((l) => l.includes("EN BLANCO")));
  }

  // Y con el separador de comas, que es el otro camino que se podia romper.
  const conComas = LOGO_GF.includes("\n") ? LOGO_GF.replace(/\n/g, ",") : LOGO_GF;
  const cc = renderLabel(conLogo(conComas), data, { scale: 1, grid: false });
  ok("tambien con el logo separado por comas", cc.cajas.some((c) => c.etiqueta === "logo"));
}

console.log(`\n${pruebas} comprobaciones, ${fallos} fallos`);
if (fallos > 0) {
  console.log("HAY FALLOS");
  process.exit(1);
}
console.log("El reescalado conserva los pixeles, la medida del logo es del dato y llega a la pantalla.");
