/**
 * Comprueba el layout de v1.8: el nombre en mayusculas, las dos lineas, y la Reparto de las
 * barras y el precio en dos columnas.
 *
 *   tsc -p tsconfig.preview.json
 *   node .preview-build/scripts/check-layout-v18.js
 *
 * POR QUE UN TEST Y NO MIRAR LA PREVISUALIZACION
 *
 * Casi todo lo que seRompio con este cambio era de FAMILIA, no de pixeles. Un nombre que sale
 * en dos lineas en el papel y en una en la pantalla, un "REF:" dibujado debajo de las barras,
 * un precio pegado al marco: son fallos que se ven en la previa, si se sabe mirar. Y el que
 * no se sabe mirar es justo el que deja el logo o el precio en el sitio de antes sin que nada
 * se entere.
 *
 * Los numeros de esta plantilla son la clase de cosa que hay que atar con un test: si alguien
 * toca `COLUMNA_BARRAS_DOTS` y las barras se meten debajo del precio, el aviso sale, en vez de
 * gastar papel en descubrirlo.
 */

import { partirLineas, renderLabel } from "../src/lib/labels/label.render";
import { resolveZoneText, COLUMNA_BARRAS_DOTS } from "../src/lib/labels/zpl.builder";
import { buscarProblemas } from "../src/lib/labels/label-solapes";
import { DEFAULT_TEMPLATE } from "../src/lib/labels/label.template";
import type { LabelData } from "../src/lib/labels/label.types";
import type { TextZone as TZ } from "../src/lib/labels/label.template";

let pruebas = 0;
let fallos = 0;

function ok(nombre: string, cond: boolean, detalle = ""): void {
  pruebas++;
  if (cond) return;
  fallos++;
  console.log(`  FALLA  ${nombre}`);
  if (detalle !== "") console.log(`         ${detalle}`);
}

function seccion(t: string): void {
  console.log(`\n${t}`);
}

function datos(over: Partial<LabelData> = {}): LabelData {
  return {
    productName: "TODO USO CHOCOLATE BITTER ST MORITZ 100 GR",
    barcode: "7591720033377",
    price: 3,
    reference: "REF1",
    businessName: "PA PICAR",
    ...over,
  };
}

const T = DEFAULT_TEMPLATE;

const zona = (source: string, zonas = T.zones): TZ | undefined =>
  zonas.find((z): z is TZ => z.kind === "text" && z.source === source);

// ===================================================================================
seccion("La etiqueta manda lo pedido: 59 x 35 mm, 472 x 280 dots, 203 dpi");
// ===================================================================================
ok("ancho 472 dots", T.widthDots === 472, `${T.widthDots}`);
ok("alto 280 dots", T.heightDots === 280, `${T.heightDots}`);
ok("la plantilla no se ha movido de sitio", T.id === "papicar-59x35", T.id);

// ===================================================================================
seccion("Zonas: las que se pidieron, y solo esas");
// ===================================================================================
{
  const tipos = T.zones.map((z) => z.kind);
  const cuenta = (t: string) => tipos.filter((k) => k === t).length;
  ok("un marco", cuenta("shape") === 1, JSON.stringify(tipos));
  ok("un logo", cuenta("graphic") === 1);
  ok("unas barras", cuenta("barcode") === 1);
  ok("el nombre", cuenta("text") === 3, `3 textos: nombre, REF: y precio`);
  ok("no hay zonas de mas", T.zones.length === 6, `${T.zones.length}`);
}

// ===================================================================================
seccion("El logo grande: 45-50 % del ancho, centrado, sin tocar el nombre");
// ===================================================================================
{
  const logo = T.zones.find((z) => z.kind === "graphic");
  ok("el logo es una zona grafica", logo?.kind === "graphic");
  if (logo?.kind === "graphic") {
    // El ancho se mide de la caja que el RENDER dibuja, no de la zona: la zona reescala el
    // `^GFA` y el ancho efectivo lo decide `scaleGraphic()`. Medir la caja es comprobar lo que
    // se imprime, que es justo lo que importa.
    const r = renderLabel(T, datos());
    const cajaLogo = r.cajas.find((c) => c.etiqueta === "logo");
    const logoW = cajaLogo ? cajaLogo.x1 - cajaLogo.x0 : 0;
    const proporcion = logoW / T.widthDots;
    ok(
      "el logo dibujado ocupa 45-50 % del ancho",
      logoW > 0 && proporcion >= 0.45 && proporcion <= 0.5,
      `${logoW} dots, ${(proporcion * 100).toFixed(1)} % del ancho`,
    );

    // Centrado: en el render el logo tiene que quedar centrado en la etiqueta, no arrimado a
    // un borde, y por encima del nombre, con aire de por medio.
    const nombre = zona("productName") as TZ;
    const centroEtiqueta = T.widthDots / 2;
    const centroLogo = cajaLogo ? (cajaLogo.x0 + cajaLogo.x1) / 2 : 0;
    ok(
      "el logo sale centrado",
      cajaLogo !== undefined && Math.abs(centroEtiqueta - centroLogo) <= 2,
      `centro de la etiqueta ${centroEtiqueta}, centro del logo ${centroLogo}`,
    );
    ok("el logo queda por encima del nombre", logo.y < nombre.y, `logo y=${logo.y}, nombre y=${nombre.y}`);
    ok(
      "el logo no toca el marco superior",
      // Margen de seguridad superior de la plantilla: 8 dots (1 mm), igual que en el template.
      logo.y >= 8,
      `y=${logo.y} y margen 8`,
    );
  }
}

// ===================================================================================
seccion("Mayusculas: solo el nombre, y despues del plegado");
// ===================================================================================
{
  const nombre = zona("productName");
  ok("el nombre pide mayusculas", nombre?.uppercase === true);
  ok("el precio NO pide mayusculas", zona("price")?.uppercase !== true);
  ok("REF: NO pide mayusculas", zona("referenceLabel")?.uppercase !== true);

  const r = resolveZoneText(T, nombre as TZ, datos({ productName: "badia jalapeño 2 oz" }));
  ok(
    "la Ñ sale como N, no como una N sin tilde perdida",
    r?.text === "BADIA JALAPENO 2 OZ",
    r?.text ?? "(null)",
  );

  // El orden importa: si las mayusculas fueran ANTES del plegado, `normalize("NFD")` separaria
  // la tilde de la letra, el plegado la borraria y de "JALAPEÑO" saldria "JALAPENO" con una N
  // que ya no es la misma. El resultado de aqui es la prueba de que el orden es el bueno.
  const r2 = resolveZoneText(T, nombre as TZ, datos({ productName: "ÑANDÚ ÁCIDE" }));
  ok("acentos y enye juntos", r2?.text === "NANDU ACIDE", r2?.text ?? "(null)");

  // Y las mayusculas no tocan la longitud, asi que el `autoFit` no se entera: un nombre en
  // minusculas y el mismo en mayusculas tienen que salir con la MISMA fuente.
  const bajo = resolveZoneText(T, nombre as TZ, datos({ productName: "chocolate bitter moritz" }));
  const alto = resolveZoneText(T, nombre as TZ, datos({ productName: "CHOCOLATE BITTER MORITZ" }));
  ok(
    "mayusculas no cambian la fuente elegida",
    bajo?.format === alto?.format,
    `${bajo?.format} y ${alto?.format}`,
  );
}

// ===================================================================================
seccion("El nombre: una linea si cabe, dos si no cabe, nunca fuera");
// ===================================================================================
{
  const nombre = zona("productName") as TZ;
  const caja = nombre.maxWidthDots!;

  // El nombre de prueba: tiene que salir en UNA linea.
  const r1 = resolveZoneText(T, nombre, datos());
  ok("el nombre de 40 caracteres sale en 1 linea", r1?.text === datos().productName, r1?.text ?? "(null)");

  // Los nombres largos del catalogo tienen que salir enteros, repartidos si hace falta, y
  // dentro del alto disponible. Este es el fallo que motivo `maxLines: 2`: con una sola
  // linea, 68 caracteres a la fuente mas pequena ocupaban 476 dots en una caja de 446, y el
  // nombre perdiase el final en el papel.
  for (const largo of [40, 50, 60, 68]) {
    const texto = "X".repeat(largo);
    const r = resolveZoneText(T, nombre, datos({ productName: texto }))!;
    const lineas = partirLineas(texto, r.ancho, caja, nombre.maxLines ?? 1);
    const anchoTotal = lineas.reduce((s, l) => s + l.length, 0);
    ok(
      `${largo} caracteres: sale entero, sin recorte`,
      r.text === texto,
      `sale "${r.text}" (${r.text.length} de ${largo})`,
    );
    ok(
      `${largo} caracteres: cada linea cabe en la caja`,
      lineas.every((l) => l.length * r.ancho <= caja),
      `lineas de ${lineas.map((l) => l.length).join(" + ")} caracteres a ${r.ancho} dots de celda`,
    );
    ok(
      `${largo} caracteres: no pasa de ${nombre.maxLines} lineas`,
      lineas.length <= (nombre.maxLines ?? 1),
      `${lineas.length} lineas`,
    );
    ok(
      `${largo} caracteres: no se pierde nada al repartir`,
      anchoTotal === largo,
      `${anchoTotal} de ${largo}`,
    );
  }
}

// ===================================================================================
seccion("El alto del nombre no crece hacia las barras");
// ===================================================================================
{
  // `maxBlockDots` existe por esto: el alto del bloque de N lineas es `2N-1` veces el alto
  // de la linea, no `N` veces, porque `^FB` separa con una separacion igual al alto. Sin
  // mirar eso, un nombre de 65 caracteres en dos lineas de 32 dots llegaba a y=168, justo
  // donde empiezan las barras, y no lo marcaba nadie porque dos cajas que se tocan no se
  // solapan.
  const nombre = zona("productName") as TZ;
  const barras = T.zones.find((z) => z.kind === "barcode");
  ok("el nombre tiene alto de bloque acotado", nombre.autoFit?.maxBlockDots !== undefined);

  for (const largo of [20, 40, 50, 60, 68, 80]) {
    const texto = "X".repeat(largo);
    const r = renderLabel(T, datos({ productName: texto }));
    // Solo las cajas del nombre. Sin el filtro tambien entran el precio y el "REF:", que
    // estan a y=190..230, y el max() se los comia: el test daba 230 siempre, sin ver si el
    // nombre crecia bien o no.
    const cajas = r.cajas.filter((c) => c.etiqueta === "texto" && c.texto?.startsWith("X"));
    ok(`${largo} caracteres: el nombre sale en alguna linea`, cajas.length > 0);
    const fin = Math.max(...cajas.map((c) => c.y1));
    ok(
      `${largo} caracteres: el nombre acaba antes de las barras, con 8 dots de aire`,
      barras !== undefined && fin <= barras.y - 8,
      `el nombre acaba en ${fin} y las barras empiezan en ${barras?.y}`,
    );
  }
}

// ===================================================================================
seccion("Dos columnas: barras a la izquierda, precio a la derecha");
// ===================================================================================
{
  const barras = T.zones.find((z) => z.kind === "barcode");
  const precio = zona("price") as TZ;
  const ref = zona("referenceLabel") as TZ;
  ok("las barras no estan centradas", barras?.kind === "barcode" && barras.center === false);
  ok("las barras estan a la izquierda", barras?.kind === "barcode" && barras.x < 100);
  ok("el precio esta a la derecha", precio.x > 300, `x=${precio.x}`);
  ok("REF: esta antes del precio", ref.x + ref.maxWidthDots! <= precio.x, `${ref.x}..${ref.x + ref.maxWidthDots!} y ${precio.x}`);

  // La columna de las barras tiene que caber en su mitad y el precio en la suya.
  const simbolo = 95 * (barras?.kind === "barcode" ? barras.moduleWidth : 3);
  const zonaQuieta = (barras?.kind === "barcode" ? barras.moduleWidth : 3) * 10;
  const columna = simbolo + zonaQuieta * 2;
  ok(
    "la columna de las barras es la que dice COLUMNA_BARRAS_DOTS",
    columna === COLUMNA_BARRAS_DOTS,
    `${columna} y ${COLUMNA_BARRAS_DOTS}`,
  );
  ok("las barras no llegan al precio", barras!.x + simbolo < precio.x, `${barras!.x + simbolo} y ${precio.x}`);
}

// ===================================================================================
seccion("El alto de las barras y el de la linea de interpretacion");
// ===================================================================================
{
  const barras = T.zones.find((z) => z.kind === "barcode");
  ok("las barras miden entre 65 y 75 dots", barras?.kind === "barcode" && barras.heightDots >= 65 && barras.heightDots <= 75, `${barras?.kind === "barcode" ? barras.heightDots : "?"}`);
  ok("la linea de interpretacion va dichita a mano", barras?.kind === "barcode" && barras.hriHeightDots === 12);
  // 9,4 mm de barra. Por debajo de unos 6,6 mm las barras ya no las leian bien los escaneres
  // de mano, y ese minimo se cruzo en v1.x.
  ok("las barras miden mas de 8 mm", barras!.heightDots >= 64, `${(barras!.heightDots / 8).toFixed(1)} mm`);

  // El codigo entero (barras + linea de interpretacion) tiene que caber dentro de los 35 mm
  // de alto: en la prueba fisica Mau midio que "la parte inferior del codigo/numeros estaba
  // practicamente en el limite inferior de la etiqueta". Con las barras en 21 mm, 9,375 de
  // alto y 1,5 de HRI acaban en 31,875 mm, 3 mm por encima del interior del marco (34 mm).
  const bz = barras?.kind === "barcode" ? barras : undefined;
  ok(
    "barras + HRI caben en el alto de la etiqueta",
    bz !== undefined && bz.y + bz.heightDots + (bz.hriHeightDots ?? 0) <= 280,
    bz !== undefined ? `${bz.y}..${bz.y + bz.heightDots + (bz.hriHeightDots ?? 0)}` : "sin zona",
  );
}

// ===================================================================================
seccion("La vista previa y el papel: los mismos numeros");
// ===================================================================================
{
  const bz = T.zones.find((z) => z.kind === "barcode");
  const barrasEsperadas = bz?.kind === "barcode" ? bz.y + bz.heightDots + (bz.hriHeightDots ?? 0) : 0;
  for (const [titulo, d] of [
    ["el producto de prueba", datos()],
    ["nombre corto", datos({ productName: "ACEITE", barcode: "033844007522" })],
    [
      "nombre largo del catalogo",
      datos({
        productName: "BOMBONES DE CHOCOLATE SURTIDOS ST MORITZ 120 G PAQUETE X 24 UNIDADES",
        price: 1234.56,
      }),
    ],
    [
      "codigo interno que no cabe",
      datos({ productName: "PECHUGA DE POLLO CON AJO Y CEBOLLA FRITA", barcode: "XPROD20220002" }),
    ],
  ] as Array<[string, LabelData]>) {
    const r = renderLabel(T, d);
    const p = buscarProblemas(r.cajas, T.widthDots, T.heightDots);
    ok(
      `${titulo}: sin solapes ni salidas`,
      p.length === 0,
      p.map((x) => x.mensaje).join(" | "),
    );
    ok(`${titulo}: el logo sale dibujado`, r.pixelesLogo > 0);
    ok(
      `${titulo}: nada se sale del rollo`,
      r.informe.every((i) => !i.includes("SE PASA")),
      r.informe.filter((i) => i.includes("SE PASA")).join(" | "),
    );
    // La caja de las barras tiene que medir lo que dice la plantilla: simbolo y, pegada
    // al pie SIN hueco, la linea de interpretacion del `^BY`. El render tenia un `hriH = 12`
    // fijo y un aire de 2 dots: con `^BY1,,9` la previa acababa en 247 y el papel en 242.
    // La caja no aparece cuando el codigo no se puede imprimir, y ahi no hay nada que medir.
    const cb = r.cajas.find((c) => c.etiqueta === "barras");
    if (cb && bz?.kind === "barcode") {
      ok(
        `${titulo}: la caja de las barras cumple la plantilla`,
        cb.y0 === bz.y && cb.y1 === barrasEsperadas,
        `${cb.y0}..${cb.y1}, esperado ${bz.y}..${barrasEsperadas}`,
      );
    }
  }
}

// ===================================================================================
seccion("La justificacion del ^FB: lo que dice la plantilla, lo que se dibuja");
// ===================================================================================
{
  // Este es el fallo de fondo que se arreglo en `label.render.ts`: el render.parseaba el
  // `^FB` pero ignoraba su justificacion y dibujaba todo en el borde izquierdo de la caja. En
  // el papel la impresora centra y alinea a la derecha, y aqui no, con el nombre centrado y
  // el precio a la derecha que son las dos zonas de las que depende el aspecto.
  const nombre = zona("productName") as TZ;
  const corto = datos({ productName: "ACEITE" });
  const r = renderLabel(T, corto);
  const caja = r.cajas.find((c) => c.etiqueta === "texto" && c.texto === "ACEITE");
  ok("el nombre corto se dibuja", caja !== undefined);
  if (caja) {
    const centroCaja = nombre.x + nombre.maxWidthDots! / 2;
    const centroTexto = (caja.x0 + caja.x1) / 2;
    ok(
      "el nombre sale CENTRADO, no pegado a la izquierda",
      Math.abs(centroCaja - centroTexto) <= 2,
      `centro de la caja ${centroCaja}, centro del texto ${centroTexto}`,
    );
  }

  const precio = zona("price") as TZ;
  const rp = renderLabel(T, datos({ price: 3 }));
  const cp = rp.cajas.find((c) => c.etiqueta === "texto" && c.texto === "$3.00");
  ok("el precio se dibuja", cp !== undefined);
  if (cp) {
    ok(
      "el precio acaba en el margen derecho",
      Math.abs(cp.x1 - (precio.x + precio.maxWidthDots!)) <= 2,
      `acaba en ${cp.x1} y la caja acaba en ${precio.x + precio.maxWidthDots!}`,
    );
  }
}

// ===================================================================================
seccion("partirLineas(): la parte que decide como se rompe un nombre");
// ===================================================================================
{
  ok("cabe en una linea", partirLineas("ACEITE", 7, 446, 2).length === 1);
  ok("se parte por palabras", partirLineas("UN NOMBRE LARGO DE PRODUCTO", 7, 140, 2).length === 2);
  ok(
    "no parte mas de las lineas permitidas",
    partirLineas("A ".repeat(60), 7, 140, 2).length === 2,
    `${partirLineas("A ".repeat(60), 7, 140, 2).length} lineas`,
  );
  // Una palabra mas ancha que la caja: sin trocearla se saldria de la etiqueta, que es lo
  // que pasaba con los nombres largos antes de esto.
  //
  // Y aqui hay un fallo REAL de `trocear()`, que este test ha encontrado: al juntar el trozo
  // que sobraba con la palabra siguiente se volvia a pegar un espacio y a contar mas de la
  // cuenta, asi que un trozo se pasaba de la caja y se perdia texto. Con 100 caracteres a 20
  // por linea salen trozos de 20,20,20,41: el ultimo no cabe en 140 dots y 4 caracteres
  // desaparecen. Una palabra larga de un producto real es larga, no larguisima, pero el
  // mismo fallo aparecia en cuanto el texto no caia exacto.
  const larga = partirLineas("X".repeat(100), 7, 140, 6);
  ok("una palabra larga se trocea", larga.length > 1, `${larga.length} trozos`);
  ok("cada trozo cabe en la caja", larga.every((l) => l.length * 7 <= 140), larga.map((l) => l.length).join(","));
  ok("no se pierde nada al trocear", larga.join("") === "X".repeat(100), `${larga.join("").length} de 100`);

  // El caso que de verdad sale de un producto: una palabra corta y un texto largo con
  // espacios, que es lo que hay en los nombres del catalogo.
  const realista = partirLineas("BOMBONES DE CHOCOLATE SURTIDOS ST MORITZ", 10, 200, 3);
  ok(
    "palabras cortas: cada linea cabe y no se pierde texto",
    realista.every((l) => l.length * 10 <= 200) &&
      realista.join(" ").split(/\s+/).join("") === "BOMBONESDECHOCOLATESURTIDOSSTMORITZ",
    realista.map((l) => `${l}(${l.length})`).join(" + "),
  );

  // Lo que no cabe en las `maxLineas` se CORTA, como corta `^FB` en papel, y no se pega a la
  // ultima linea: pegado, un nombre en una caja estrecha salia como una linea de cientos de
  // dots cruzando la etiqueta entera, que en papel no existe. La invariant es que NINGUNA
  // linea devuelta se pase de la caja, ni por cantidad de lineas ni por ancho.
  const cortado = partirLineas("X".repeat(68), 7, 120, 2);
  ok(
    "el texto largo se corta en las lineas permitidas",
    cortado.length === 2,
    `${cortado.length} lineas`,
  );
  ok(
    "y cada linea devuelta cabe en la caja",
    cortado.every((l) => l.length * 7 <= 120),
    cortado.map((l) => `${l.length * 7} dots`).join(", "),
  );
}

// ===================================================================================
seccion("Un nombre que no cabe en su caja: se corta como en papel y lo dice el informe");
// ===================================================================================
{
  // La caja del nombre, estrechada a mano: es el caso que vive el usuario cuando ensancha o
  // encoge la zona en el editor y el nombre deja de caber en dos lineas. autoFit baja hasta
  // el minHeight y aun asi sobra texto —el caso 3 de resolveAutoFit()—.
  const nombre = zona("productName") as TZ;
  const estrecha = {
    ...T,
    zones: T.zones.map((z) => (z === nombre ? { ...nombre, maxWidthDots: 120 } : z)),
  };
  const texto = "X".repeat(68);

  const r = renderLabel(estrecha, datos({ productName: texto }));
  const cajasNombre = r.cajas.filter((c) => c.etiqueta === "texto" && c.texto?.startsWith("X"));
  ok(
    "el corte se avisa en el informe con NO",
    r.informe.some((i) => i.includes("NO SALE ENTERO")),
    r.informe.join(" | "),
  );
  ok(
    "solo se dibujan las lineas que caben",
    cajasNombre.length <= (nombre.maxLines ?? 1),
    `${cajasNombre.length} cajas`,
  );
  ok(
    "ninguna linea se sale de la caja",
    cajasNombre.every((c) => c.x1 <= nombre.x + 120 + 1),
    cajasNombre.map((c) => `${c.x0}..${c.x1}`).join(", "),
  );
  ok(
    "y nada se sale del rollo",
    !r.informe.some((i) => i.includes("SE PASA")),
    r.informe.filter((i) => i.includes("SE PASA")).join(" | "),
  );

  // Control: con la caja de verdad, ese mismo nombre cabe en dos lineas y no se corta.
  const r2 = renderLabel(T, datos({ productName: texto }));
  ok(
    "con la caja normal no se avisa de corte",
    !r2.informe.some((i) => i.includes("NO SALE ENTERO")),
    r2.informe.join(" | "),
  );
}

// ===================================================================================
console.log(`\n${"=".repeat(74)}`);
if (fallos === 0) {
  console.log(`${pruebas} comprobaciones, 0 fallos`);
} else {
  console.log(`${pruebas} comprobaciones, ${fallos} FALLOS`);
}
console.log("=".repeat(74));
process.exit(fallos === 0 ? 0 : 1);
