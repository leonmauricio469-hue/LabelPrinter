// Comprueba que dos zonas de una plantilla NO se pisan.
//
// El motor no sabe nada de esto: `buildZpl()` va soltando los comandos en orden y si dos
// zonas se solapan, la de arriba se come a la de abajo y no sale ningun aviso. Un producto con
// nombre largo baja la fuente, pero las barras y la linea de interpretacion tienen altura fija,
// y ahi es donde se han producido los choques.
//
// No sustituye a mirar la etiqueta impresa. Lo que hace es acabar con el error tonto: un
// numero puesto por encima de la zona de barras.
//
//   tsc -p tsconfig.preview.json
//   node .preview-build/scripts/check-zonas.js
import { TEMPLATES, DEFAULT_TEMPLATE } from "../src/lib/labels/label.template";
import { graphicDots } from "../src/lib/labels/gf-graphic";
import { intersectan } from "../src/lib/labels/label-solapes";
import type { LabelTemplate, LabelZone } from "../src/lib/labels/label.template";
import { planForZone, barcodeZoneOf, problemaDeMedio, buildZpl } from "../src/lib/labels/zpl.builder";
import type { BarcodeImprimible } from "../src/lib/labels/barcode-plan";
import { zoneSchema } from "../src/lib/labels/label-zones.schema";
import { readFileSync } from "node:fs";

interface Caja {
  etiqueta: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  texto?: string;
}

function altoDeFuente(format: string): number {
  const m = /\^A0N,(\d+)/.exec(format);
  return m ? Number(m[1]) : 0;
}

function anchoDeFuente(format: string): number {
  const m = /\^A0N,(\d+),(\d+)/.exec(format);
  return m ? Number(m[2]) : 0;
}

/**
 * Mismo calculo que `resolveAutoFit()` en el builder. Va replicado a proposito: si el
 * builder cambia la politica, este script tiene que avisar, no seguir mintiendo en verde.
 */
function resolverFormato(zone: Extract<LabelZone, { kind: "text" }>, largo: number): string {
  if (!zone.autoFit || zone.maxWidthDots === undefined || largo === 0) return zone.format;
  const { maxHeight, minHeight, widthRatio } = zone.autoFit;
  let alto = maxHeight;
  while (alto > minHeight && largo * Math.max(1, Math.round(alto * widthRatio)) > zone.maxWidthDots) {
    alto -= 1;
  }
  return `^A0N,${alto},${Math.max(1, Math.round(alto * widthRatio))}`;
}

function autoHeight(zone: Extract<LabelZone, { kind: "text" }>, largo: number): number {
  return altoDeFuente(resolverFormato(zone, largo));
}

function cajasDeTexto(zone: Extract<LabelZone, { kind: "text" }>, largo: number): Caja[] {
  const total = (zone.prefix?.length ?? 0) + largo;
  const format = resolverFormato(zone, largo);
  const h = altoDeFuente(format);
  const w = anchoDeFuente(format);

  if (zone.maxWidthDots !== undefined && zone.maxLines !== undefined) {
    const porLinea = Math.max(1, Math.floor(zone.maxWidthDots / Math.max(1, w)));
    const lineas = Math.min(zone.maxLines, Math.ceil(total / porLinea));
    // ^FB avanza cada linea por el alto de la fuente mas el interlineado, que va por defecto.
    const altoLinea = h + 5;
    const out: Caja[] = [];
    for (let i = 0; i < lineas; i++) {
      out.push({
        etiqueta: `texto ${zone.source} linea ${i + 1}`,
        x0: zone.x,
        y0: zone.y + i * altoLinea,
        x1: zone.x + zone.maxWidthDots,
        y1: zone.y + i * altoLinea + h,
      });
    }
    return out;
  }

  return [
    {
      etiqueta: `texto ${zone.source}`,
      x0: zone.x,
      y0: zone.y,
      x1: zone.x + total * w,
      y1: zone.y + h,
    },
  ];
}

/**
 * Alto de la linea de interpretacion cuando la zona NO lo dice.
 *
 * No es 10 veces el ancho de modulo, que es lo que parece al leerlo de lejos. Segun el manual
 * de ZPL II, `^BY` sin argumento `h` deja la linea de interpretacion a la altura de la fuente
 * que este vigente, que es la ultima que se emitio antes del comando de simbolo.
 *
 * Verificado sobre el ZPL real de la plantilla de 50 x 25 mm (v1.2, ya borrada): las barras se
 * emitian con `^BY3` a secas, y justo antes el precio habia puesto `^A0N,24,15`. La linea
 * salia a 24 dots, en 168..192, contra la referencia en 186..198.
 */
function altoHriPorDefecto(template: LabelTemplate): number {
  const indiceBarcode = template.zones.findIndex((z) => z.kind === "barcode");
  if (indiceBarcode < 0) return 0;
  for (let i = indiceBarcode - 1; i >= 0; i--) {
    const z = template.zones[i];
    if (z && z.kind === "text") {
      const h = autoHeight(z, 50);
      if (h > 0) return h;
    }
  }
  return 0;
}

function cajasDeBarcode(
  zone: Extract<LabelZone, { kind: "barcode" }>,
  plan: BarcodeImprimible,
  anchoEtiqueta: number,
  hriPorDefecto: number,
): Caja[] {
  const simbolo = plan.modules * plan.moduleWidth;
  const hri = zone.hriHeightDots ?? hriPorDefecto;
  const x0 = zone.center ? Math.round((anchoEtiqueta - simbolo) / 2) : zone.x;

  const cajas: Caja[] = [
    { etiqueta: "barras", x0, y0: zone.y, x1: x0 + simbolo, y1: zone.y + zone.heightDots },
  ];
  if (zone.interpretationLine) {
    cajas.push({
      etiqueta: `linea de interpretacion (alto ${hri})`,
      x0,
      y0: zone.y + zone.heightDots,
      x1: x0 + simbolo,
      y1: zone.y + zone.heightDots + hri,
    });
  }
  return cajas;
}

/**
 * Dos cajas se pisan de verdad.
 *
 * Delega en `intersectan()` de `label-solapes.ts`, que es la misma regla que usan el editor y el
 * endpoint que guarda, para que este script no pueda dar verde con una cuenta y la pantalla
 * naranja con otra.
 *
 * La exencion de contencion que hay para el marco NO se aplica aqui, y no por capricho: estas
 * cajas no llevan el marco, y entre contenido no hay exencion. Un texto metido dentro de las
 * barras esta encima de las barras.
 */
function seSolapan(a: Caja, b: Caja): boolean {
  return intersectan(
    { etiqueta: a.etiqueta, x0: a.x0, y0: a.y0, x1: a.x1, y1: a.y1, texto: a.texto },
    { etiqueta: b.etiqueta, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, texto: b.texto },
  );
}

/** Lo mismo que hace `foldAscii()` en los signos que salen en el catalogo. */
function plegar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00d1/g, "N");
}

// Nombres representativos del catalogo real: corto, mediana, percentil 90 y el maximo.
const NOMBRES = [
  "ACETAMINOFEN",
  "7 ESPECIES 150 GR",
  "BOMBONES DE CHOCOLATE SURTIDOS ST MORITZ 120 G",
  "BADIA JALAPENO MOLIDO 2 OZ",
  "BOMBONES DE CHOCOLATE SURTIDOS ST MORITZ 120 G PAQUETE X 24 UNIDADES",
  "YOGURT FRESCO SABOR FRUIT 1/2 LITRO DESCREMADO YOGURT VASE CON CUBIERTA 4 X 100 G",
];

/**
 * Caracteres de cada fuente segun de donde sale el texto.
 *
 * Antes se le pasaba a todas las zonas la longitud del nombre y salia que el precio se
 * salia del rollo. No era un fallo de la plantilla: es que un precio de 7 caracteres no
 * ocupa lo mismo que un nombre de 50.
 */
const LARGO_POR_FUENTE: Record<string, number> = {
  productName: 0, // se rellena con el nombre que se esta probando
  price: 8, // "$1234.56", el precio mas largo que se ha visto en el catalogo, con el signo
  reference: 12,
  referenceLabel: 4, // "REF:"
  barcodeData: 13,
  barcode: 13,
  businessName: 8,
  header: 8,
};

let fallos = 0;
let pruebas = 0;
const problemas: string[] = [];

/**
 * Solapes que ya existen, se han impreso y se han dejado como estan.
 *
 * Ponerlos aqui NO es decir que no importen. Es decir que arreglarlo cambia el ZPL de una
 * plantilla que ya salio en papel, y ese papel hay que volver a mirarlo antes de darlo por
 * bueno.
 *
 * La clave es de la zona y del par que se pisa, para que si el reparto de la plantilla cambia
 * esto salte en vez de estorbar.
 *
 * VACIO desde v1.3. La unica entrada que habia era el solape de 6 dots entre la linea de
 * interpretacion y `REF:` de la plantilla de 50 x 25 mm, que se llevo por delante la
 * plantilla entera. La de 59 x 35 mm lo evita diciendo `hriHeightDots: 12` en la zona de
 * barras, en vez de dejar que la linea caiga a la altura de la fuente vigente.
 */
const SOLAPES_CONOCIDOS: Record<string, string> = {};

let conocidos = 0;

function fallo(plantilla: LabelTemplate, nombre: string, clave: string, msg: string): void {
  fallos++;
  const conocido = SOLAPES_CONOCIDOS[`${plantilla.id}|${clave}`];
  if (conocido) conocidos++;
  const linea = conocido ? `\n    CONOCIDO: ${conocido}` : "";
  if (problemas.length < 40) problemas.push(`  ${plantilla.id}  "${nombre}"\n    ${msg}${linea}`);
}

for (const template of TEMPLATES) {
  console.log("=".repeat(72));
  console.log(
    `${template.id}  ${template.widthMm} x ${template.heightMm} mm  =  ${template.widthDots} x ${template.heightDots} dots  (${template.zones.length} zonas)`,
  );
  console.log("=".repeat(72));

  const bz = barcodeZoneOf(template);
  const plan = bz ? planForZone(template, bz, "0332000034030") : null;
  if (plan && !plan.printable) {
    console.log(`  (con el codigo de prueba este producto NO lleva barras; solo se comprueban las zonas de texto)`);
  }
  const cajasBarcode: Caja[] =
    bz && plan?.printable
      ? cajasDeBarcode(bz, plan, template.widthDots, altoHriPorDefecto(template))
      : [];

  const marco = template.zones.find((z) => z.kind === "shape");
  const interior = marco && marco.kind === "shape"
    ? {
        izq: marco.x + marco.thicknessDots,
        arr: marco.y + marco.thicknessDots,
        der: marco.x + marco.widthDots - marco.thicknessDots,
        aba: marco.y + marco.heightDots - marco.thicknessDots,
      }
    : null;

  for (const nombre of NOMBRES) {
    const plegado = plegar(nombre);
    const cajas: Caja[] = [];
    for (const z of template.zones) {
      if (z.kind === "text") {
        const largo = z.source === "productName" ? plegado.length : (LARGO_POR_FUENTE[z.source] ?? 8);
        cajas.push(...cajasDeTexto(z, largo));
      } else if (z.kind === "graphic") {
        // Del tamaño real del ^GFA, no a mano y no de una constante al lado: si
        // `generate-logo.ps1` regenera el logo mas grande, o si `/editor` lo reescala, esta
        // comprobacion tiene que crecer con el o dira que no hay choques cuando si los hay.
        const logo = graphicDots(z.gf);
        if (logo.fallo || !logo.dots) {
          problemas.push(`${template.id}: el ^GF del logo no se puede medir (${logo.fallo})`);
        } else {
          cajas.push({
            etiqueta: "logo",
            x0: z.x,
            y0: z.y,
            x1: z.x + logo.dots.w,
            y1: z.y + logo.dots.h,
          });
        }
      }
    }
    cajas.push(...cajasBarcode);

    // 1) Nada se sale de la etiqueta.
    for (const c of cajas) {
      pruebas++;
      if (c.x0 < 0 || c.y0 < 0 || c.x1 > template.widthDots || c.y1 > template.heightDots) {
        fallo(
          template,
          nombre,
          `fuera-de-rollo|${c.etiqueta}`,
          `FUERA  ${c.etiqueta} en ${c.x0},${c.y0}..${c.x1},${c.y1} contra rollo ${template.widthDots}x${template.heightDots}`,
        );
      }
    }

    // 2) Todo cabe dentro del marco, si hay marco.
    if (interior) {
      for (const c of cajas) {
        pruebas++;
        if (c.x0 < interior.izq || c.x1 > interior.der || c.y0 < interior.arr || c.y1 > interior.aba) {
          fallo(
            template,
            nombre,
            `fuera-del-marco|${c.etiqueta}`,
            `MARCO  ${c.etiqueta} en ${c.x0},${c.y0}..${c.x1},${c.y1} contra interior ${interior.izq},${interior.arr}..${interior.der},${interior.aba}`,
          );
        }
      }
    }

    // 3) Dos zonas de contenido no se pisan entre si.
    for (let i = 0; i < cajas.length; i++) {
      for (let j = i + 1; j < cajas.length; j++) {
        pruebas++;
        if (seSolapan(cajas[i], cajas[j])) {
          // El par se ordena para que la clave del problema conocido no cambie segun el
          // orden en que se comprueban las zonas.
          const par = [cajas[i].etiqueta, cajas[j].etiqueta].sort().join("|");
          fallo(
            template,
            nombre,
            `choque|${par}`,
            `CHOQUE ${cajas[i].etiqueta} ${cajas[i].x0},${cajas[i].y0}..${cajas[i].x1},${cajas[i].y1}` +
              `\n    contra ${cajas[j].etiqueta} ${cajas[j].x0},${cajas[j].y0}..${cajas[j].x1},${cajas[j].y1}`,
          );
        }
      }
    }
  }

  // Reparto vertical, para ver donde cae cada cosa.
  const cajasResumen: Caja[] = [];
  for (const z of template.zones) {
    if (z.kind === "text") {
      const largo = z.source === "productName" ? 50 : (LARGO_POR_FUENTE[z.source] ?? 8);
      cajasResumen.push(...cajasDeTexto(z, largo));
    } else if (z.kind === "graphic") {
      const logo = graphicDots(z.gf);
      if (logo.dots) {
        cajasResumen.push({
          etiqueta: "logo",
          x0: z.x,
          y0: z.y,
          x1: z.x + logo.dots.w,
          y1: z.y + logo.dots.h,
        });
      }
    }
  }
  cajasResumen.push(...cajasBarcode);
  cajasResumen.sort((a, b) => a.y0 - b.y0);
  for (const c of cajasResumen) {
    console.log(
      `  y ${String(c.y0).padStart(3)}..${String(c.y1).padStart(3)}  ${c.etiqueta.padEnd(28)} x ${c.x0}..${c.x1}`,
    );
  }
  console.log(`  (nombre de 50 caracteres, que es el peor caso del catalogo)`);
  console.log(`  ${NOMBRES.length} nombres x ${template.zones.length} zonas`);
}

// ------------------------------------------------------------------ el medio y el diseño

// ESTO ES LO QUE MAS CARO SALIA Y NO AVISABA.
//
// `^PW` no escala: recorta. Con un rollo de 50 mm y una etiqueta de 59, `^PW400` recorta todo
// lo que pase de 400 dots. El ZPL sigue siendo valido, la impresora no protesta, el trabajo
// sale de la cola como entregado, y la etiqueta llega con el lado derecho comido. Ni la
// previsualizacion ni el ZPL lo enseñan: la previsualizacion dibuja el diseño, y el ZPL no
// dice "he recortado", dice los numeros que le han dado.
console.log("El medio tiene que admitir el diseño");
{
  const diseno = DEFAULT_TEMPLATE.widthDots;
  const mmDeDiseno = DEFAULT_TEMPLATE.widthMm;
  const data = {
    productName: "BADIA JALAPENO 2 OZ",
    barcode: "033844007522",
    price: 5.68,
    reference: "RETAIL",
    businessName: "PA PICAR",
  };

  // Igual que el diseño: el caso de serie, y el que sale si nadie ha tocado nada.
  pruebas++;
  if (problemaDeMedio(DEFAULT_TEMPLATE, diseno) !== null) {
    fallos++;
    problemas.push("medio-igual: el medio igual al diseño se toma por problema");
  }

  // Más ancho: sale entero, con blanco de más. No es un problema.
  pruebas++;
  if (problemaDeMedio(DEFAULT_TEMPLATE, diseno + 24) !== null) {
    fallos++;
    problemas.push("medio-mayor: un rollo más ancho que la etiqueta se toma por problema");
  }

  // Más estrecho: esto es lo que tiene que salir, y con los dos números en el texto, que es
  // lo que la persona necesita para saber qué cambiar.
  pruebas++;
  const corto = problemaDeMedio(DEFAULT_TEMPLATE, 400);
  if (corto === null) {
    fallos++;
    problemas.push("medio-menor: con 50 mm de rollo y 59 de etiqueta no se dice nada");
  } else {
    pruebas++;
    if (!corto.includes("50.00") || !corto.includes(`${mmDeDiseno.toFixed(2)}`)) {
      fallos++;
      problemas.push(`medio-menor: el motivo no trae los dos números: ${corto}`);
    }
  }

  // Y que el ZPL que sale lleva el ancho del MEDIO, no el del diseño. Con un rollo de 62 mm,
  // `^PW` tiene que ser 496 aunque la plantilla mida 472.
  const zpl = buildZpl(DEFAULT_TEMPLATE, data, { mediaWidthDots: 496 });
  pruebas++;
  if (!zpl.includes("^PW496")) {
    fallos++;
    problemas.push(`^PW: con medio de 62 mm sale ${zpl.match(/\^PW\d+/)?.[0]}, se esperaba ^PW496`);
  }

  // Sin opciones, `^PW` es el del diseño: es lo que necesitan el editor y estas pruebas, que
  // dibujan la etiqueta y no el rollo.
  pruebas++;
  if (!buildZpl(DEFAULT_TEMPLATE, data).includes(`^PW${diseno}`)) {
    fallos++;
    problemas.push("^PW: sin opciones no sale el ancho del diseño");
  }

  // `^LL` es SIEMPRE el alto del diseño, aunque el rollo sea más largo. Es cuanto avanza el
  // papel entre etiquetas, y el rollo se corta a mano: ponerlo al alto del rollo haria que
  // la impresora gastara un rectangulo entero de papel por cada etiqueta.
  pruebas++;
  const ll = zpl.match(/\^LL(\d+)/)?.[1];
  if (ll !== String(DEFAULT_TEMPLATE.heightDots)) {
    fallos++;
    problemas.push(`^LL: sale ${ll} y deberia ser el alto del diseño, ${DEFAULT_TEMPLATE.heightDots}`);
  }

  // Un rollo de 0, o un valor que venga en blanco desde el formulario, tienen que Contar como
  // problema y no colarse: `^PW0` recorta la etiqueta entera y sale un rollo de papel en
  // blanco, que es el peor resultado posible y el mas silencioso de todos.
  pruebas++;
  if (problemaDeMedio(DEFAULT_TEMPLATE, 0) === null) {
    fallos++;
    problemas.push("medio-cero: un ancho de 0 se acepta, y recorta la etiqueta entera");
  }
  pruebas++;
  if (problemaDeMedio(DEFAULT_TEMPLATE, Number.NaN) === null) {
    fallos++;
    problemas.push("medio-NaN: se acepta, y dejaria ^PW como NaN");
  }
}

// ===================================================================================
// El esquema de la API tiene que saber TODOS los campos de la zona.
// ===================================================================================
//
// Este bloque no va de solapes: va de que el editor y la impresora digan lo mismo.
//
// `z.object` no se queja cuando le llega una clave que no ha declarado: la tira. Y el tipado
// `z.ZodType<LabelZone>` tampoco lo avisa, porque que el esquema ACEPTE un tipo no es lo mismo
// que lo CONSERVA entero. Asi que añadir un campo a `TextZone` y no añadirlo aqui no da error
// de compilacion, no da error en el servidor y no da error en la pantalla: el navegador manda
// la zona con el campo, el servidor dibuja sin el, y el preview enseña un layout que no es el
// de la plantilla. Pasaba con `uppercase` y con `autoFit.maxBlockDots`: el nombre se veia
// pegado a las barras en el editor y con aire en `ver-layout`, y el unico sitio donde se
// la unica que era correcta era el volcado.
//
// La comprobacion es de ida y de vuelta, y por los dos lados:
//   - de la plantilla al esquema: si un campo que la plantilla usa no lo declara el esquema,
//     mandandola por la API se pierde;
//   - del esquema a la plantilla: si el esquema declara algo que `TextZone` no tiene, el
//     campo sobra y es codigo muerto que no se limpia nunca.
{
  const camposDe = (v: object): string[] => Object.keys(v).sort();

  for (const plantilla of TEMPLATES) {
    const zonas = [...plantilla.zones, ...(plantilla.zonesWithoutBarcode ?? [])];

    // Ida: la zona de la plantilla, tal cual, tiene que salir del esquema igual que entro.
    const ida = zoneSchema.safeParse(zonas[0]);
    pruebas++;
    if (!ida.success) {
      fallos++;
      problemas.push(
        `esquema: la primera zona de ${plantilla.id} no valida: ${ida.error.message}`,
      );
    }

    for (const zona of zonas) {
      const vuelta = zoneSchema.safeParse(zona);
      pruebas++;
      if (!vuelta.success) continue;

      if (zona.kind !== "text") continue;
      const original = zona as unknown as Record<string, unknown>;
      const parseado = vuelta.data as unknown as Record<string, unknown>;

      for (const campo of camposDe(original)) {
        if (campo === "autoFit") continue;
        pruebas++;
        if (!(campo in parseado)) {
          fallos++;
          problemas.push(
            `esquema: ${plantilla.id} manda el campo "${campo}" y el esquema lo descarta. ` +
              `Anadelo a label-zones.schema.ts.`,
          );
        }
      }

      if (original.autoFit && typeof original.autoFit === "object") {
        const afOrig = original.autoFit as Record<string, unknown>;
        const afParseado =
          typeof parseado.autoFit === "object" && parseado.autoFit !== null
            ? (parseado.autoFit as Record<string, unknown>)
            : {};
        for (const campo of camposDe(afOrig)) {
          pruebas++;
          if (!(campo in afParseado)) {
            fallos++;
            problemas.push(
              `esquema: ${plantilla.id} manda "autoFit.${campo}" y el esquema lo descarta. ` +
                `Anadelo a label-zones.schema.ts.`,
            );
          }
        }
      }
    }
  }

  // Vuelta: ningun campo del esquema que la plantilla no conozca. Se comparan las claves
  // declaradas en el `.ts` contra las de la plantilla, leyéndolas del fichero, porque en
  // tiempo de ejecucion Zod ya no dice quais ha declarado.
  const ruta = "src/lib/labels/label-zones.schema.ts";
  const texto = readFileSync(ruta, "utf8");
  const bloque = texto.slice(texto.indexOf('kind: z.literal("text")'), texto.indexOf('kind: z.literal("barcode")'));
  const declarados = new Set<string>();
  for (const m of bloque.matchAll(/^\s{6}([a-zA-Z][a-zA-Z0-9]*):/gm)) declarados.add(m[1]);
  const delAutoFit = bloque.slice(bloque.indexOf("autoFit"));
  for (const m of delAutoFit.matchAll(/^\s{10}([a-zA-Z][a-zA-Z0-9]*):/gm)) declarados.add(m[1]);

  const conosidos = new Set([
    "kind", "x", "y", "format", "source", "prefix", "uppercase", "maxWidthDots",
    "maxLines", "justify", "autoFit", "maxHeight", "minHeight", "widthRatio", "maxBlockDots",
  ]);
  for (const campo of declarados) {
    pruebas++;
    if (!conosidos.has(campo)) {
      fallos++;
      problemas.push(
        `esquema: "${campo}" esta en ${ruta} pero no existe en TextZone. ` +
          `O es un campo nuevo que hay que anadir a la plantilla, o sobra y hay que quitarlo.`,
      );
    }
  }
}

if (problemas.length) {
  console.log("\n" + problemas.join("\n"));
}
const nuevos = fallos - conocidos;
console.log(`\n${pruebas} comprobaciones, ${fallos} incidences: ${conocidos} conocidas, ${nuevos} nuevas`);
if (nuevos > 0) {
  console.log("HAY SOLAPES O FUGAS NUEVAS. La etiqueta se imprime encima de si misma.");
  process.exit(1);
}
console.log(
  conocidos > 0
    ? `Sin solapes nuevos. Quedan ${conocidos} incidencias declaradas en SOLAPES_CONOCIDOS.`
    : "Ningun solape, nada se sale del rollo.",
);
