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
import { TEMPLATES } from "../src/lib/labels/label.template";
import type { LabelTemplate, LabelZone } from "../src/lib/labels/label.template";
import { planForZone, barcodeZoneOf } from "../src/lib/labels/zpl.builder";
import type { BarcodeImprimible } from "../src/lib/labels/barcode-plan";

interface Caja {
  etiqueta: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
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
 * Verificado sobre el ZPL real de la plantilla de 50 mm: las barras se emiten con `^BY3` a
 * secas, y justo antes el precio habia puesto `^A0N,24,15`. La linea sale a 24 dots, en
 * 168..192, contra la referencia en 186..198.
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

function seSolapan(a: Caja, b: Caja): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
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
 * bueno. Un `hriHeightDots: 12` en la zona de barras de 50 mm lo quita en una linea.
 *
 * La clave es de la zona y del par que se pisa, para que si el reparto de la plantilla cambia
 * esto salte en vez de estorbar.
 */
const SOLAPES_CONOCIDOS: Record<string, string> = {
  "papicar-50x25|choque|linea de interpretacion (alto 24)|texto reference":
    "La linea de interpretacion cae a la altura de la fuente vigente, que es la del precio " +
    "(`^A0N,24`), y se come 6 dots de `REF:`. Preexistente en v1.1, impreso y sin mirar de cerca. " +
    "Se arregla con un `hriHeightDots: 12` en la zona de barras, pero eso cambia el ZPL de una " +
    "plantilla que ya salio en papel.",
};

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
        // El ^GFA mide 200 x 67, ver pa-picar-logo.ts
        cajas.push({ etiqueta: "logo", x0: z.x, y0: z.y, x1: z.x + 200, y1: z.y + 67 });
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
      cajasResumen.push({ etiqueta: "logo", x0: z.x, y0: z.y, x1: z.x + 200, y1: z.y + 67 });
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
