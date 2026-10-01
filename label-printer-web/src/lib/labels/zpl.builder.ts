import type { LabelData } from "./label.types";
import type {
  LabelTemplate,
  BarcodeZone,
  LabelZone,
  TextZone,
  ShapeZone,
} from "./label.template";
import { planBarcode, barcodeFormat, QUIET_FACTOR } from "./barcode-plan";
import type { BarcodePlan } from "./barcode-plan";
import { foldField } from "./ascii.fold";

/**
 * Que symbologia lleva un codigo en una etiqueta concreta.
 *
 * Es un envoltorio de `planBarcode()` con los parametros de la etiqueta puestos, para que
 * quien construye el ZPL no tenga que acordarse del ancho de modulo ni del factor de zona
 * quieta. Toda la decision vive en `barcode-plan.ts`.
 */
export function planForZone(
  template: LabelTemplate,
  zone: BarcodeZone,
  barcode: string,
): BarcodePlan {
  return planBarcode(barcode, {
    labelWidthDots: template.widthDots,
    moduleWidthDots: zone.moduleWidth,
    quietFactor: QUIET_FACTOR,
  });
}

export function barcodeZoneOf(template: LabelTemplate): BarcodeZone | undefined {
  return template.zones.find((z): z is BarcodeZone => z.kind === "barcode");
}

/** Ancho del simbolo en dots, o 0 si el codigo no se puede imprimir. */
export function symbolDots(zone: BarcodeZone, plan: BarcodePlan): number {
  return plan.printable ? plan.modules * zone.moduleWidth : 0;
}

function barcodeX(template: LabelTemplate, zone: BarcodeZone, plan: BarcodePlan): number {
  if (!zone.center) return zone.x;
  return Math.max(0, Math.round((template.widthDots - symbolDots(zone, plan)) / 2));
}

/**
 * Zona quieta a la derecha con el barcode centrado. Negativa si el simbolo no cabe.
 *
 * El estandar pide 10X a cada lado. X es el ancho de modulo en dots, o sea
 * `zone.moduleWidth`: el suelo de la zona quieta crece con el, no es un numero fijo.
 */
export function quietZoneDots(
  template: LabelTemplate,
  zone: BarcodeZone,
  plan: BarcodePlan,
): number {
  return template.widthDots - barcodeX(template, zone, plan) - symbolDots(zone, plan);
}

/**
 * Que zonas se emiten, y con que symbologia.
 *
 * Se resuelve ANTES de emitir nada, y no zona a zona, porque cuando el codigo no se puede
 * imprimir no basta con callarse la zona del barcode: sobrarian 12,5 mm de papel en blanco
 * en 261 de los 3080 productos del catalogo real, y eso parece una etiqueta rota. Con
 * `zonesWithoutBarcode` la etiqueta entera se recompone.
 *
 * Se devuelve siempre el plan, tambien con la lista alternativa, para que quien llama
 * pueda avisar al operador sin tener que recalcularlo.
 */
export function resolveLabel(
  template: LabelTemplate,
  data: LabelData,
): { zones: LabelZone[]; plan: BarcodePlan } {
  const zone = barcodeZoneOf(template);
  if (!zone) {
    return {
      zones: template.zones,
      plan: { printable: false, reason: "vacio", detail: "la plantilla no tiene zona de codigo" },
    };
  }
  const plan = planForZone(template, zone, data.barcode);
  const sinCodigo = !plan.printable && template.zonesWithoutBarcode;
  return { zones: sinCodigo ? template.zonesWithoutBarcode! : template.zones, plan };
}

/**
 * ZPL de un rectangulo de esquinas redondeadas.
 *
 * `^GB` trae radio de esquina de serie: `^GBw,h,t,B,0,r` dibuja el contorno, deja el interior
 * en blanco y redondea las cuatro esquinas con `r`. Con `r` a 0 sale el rectangulo de esquinas
 * vivas. No hacen falta circulos ni cuatro comandos.
 *
 * OJO con el radio: el manual de ZPL II documenta `r` entre 0 y 8 dots, que a 203 dpi son
 * 1 mm. La plantilla pide 16 (2 mm), asi que ese caso todavia no se ha visto en fisico. Si el
 * firmware de la GK420t se lo come tal cual, sale redondeado a 1 mm, que es aceptable. Si se
 * queja, se baja el numero en la plantilla.
 */
function shapeCommands(zone: ShapeZone): string[] {
  const r = Math.max(0, Math.min(zone.radiusDots ?? 0, Math.floor(zone.widthDots / 2), Math.floor(zone.heightDots / 2)));
  const t = Math.max(1, zone.thicknessDots);
  return [
    `^FO${zone.x},${zone.y}`,
    `^GB${zone.widthDots},${zone.heightDots},${t},B,0,${r}^FS`,
  ];
}

/**
 * Resuelve el alto de fuente de una zona con `autoFit`.
 *
 * Busca el mayor alto, del `maxHeight` hacia abajo, con el que el texto entra en UNA linea de
 * `maxWidthDots`. Si ni al `minHeight` cabe, devuelve `minHeight` y el texto se sale un poco
 * por el lado, que es preferible a hacerlo mas pequeno todavia: por debajo de 1,6 mm de alto
 * de letra los escaneres de mano ya empiezan a fallar.
 *
 * El texto va plegado a ASCII antes de medir, porque `foldAscii()` puede acortar un nombre
 * (un acento suelto se convierte en nada). Medir la cadena original y mandar la plegada
 * daria una anchura equivocada.
 */
function resolveAutoFit(zone: TextZone, text: string): string | null {
  if (!zone.autoFit || zone.maxWidthDots === undefined) return null;
  const { maxHeight, minHeight, widthRatio } = zone.autoFit;
  if (text.length === 0) return null;

  const chars = text.length;
  let alto = maxHeight;
  while (alto > minHeight && chars * Math.max(1, Math.round(alto * widthRatio)) > zone.maxWidthDots) {
    alto -= 1;
  }
  return `^A0N,${alto},${Math.max(1, Math.round(alto * widthRatio))}`;
}

function textFor(zone: TextZone, data: LabelData, plan: BarcodePlan): string {
  const raw =
    zone.source === "header"
      ? (zone.header ?? data.businessName)
      : zone.source === "referenceLabel"
        ? "REF:"
        : zone.source === "barcodeData"
          ? (plan.printable ? plan.data : "")
          : zone.source === "price"
            ? data.price.toFixed(2)
            : String(data[zone.source]);

  // El plegado va aqui y no en la zona: cualquier texto que llegue a `^FD` pasa por aqui,
  // este o no el que la plantilla quiera.
  return `${zone.prefix ?? ""}${foldField(raw)}`;
}

function emit(template: LabelTemplate, zones: LabelZone[], data: LabelData, plan: BarcodePlan): string {
  const commands: string[] = [
    "^XA",
    `^PW${template.widthDots}`,
    `^LL${template.heightDots}`,
    "^LH0,0",
  ];

  for (const zone of zones) {
    if (zone.kind === "shape") {
      commands.push(...shapeCommands(zone));
      continue;
    }

    if (zone.kind === "graphic") {
      commands.push(`^FO${zone.x},${zone.y}`, zone.gf);
      continue;
    }

    if (zone.kind === "barcode") {
      // Aqui se decide la symbologia. Si el codigo no se puede imprimir y la plantilla no
      // trae lista alternativa, la zona no se emite: es preferible una etiqueta sin codigo
      // a un simbolo recortado, que sale bonito y no lo lee nadie.
      if (!plan.printable) continue;
      commands.push(
        barcodeFormat(plan, zone.heightDots, zone.interpretationLine, zone.hriHeightDots),
        `^FO${barcodeX(template, zone, plan)},${zone.y}`,
        `^FD${plan.data}^FS`,
      );
      continue;
    }

    const text = textFor(zone, data, plan);
    if (text === "") continue;

    // El ajuste automatico manda sobre el `format` de la plantilla cuando esta configurado:
    // por eso va antes de la instruccion de fuente.
    commands.push(resolveAutoFit(zone, text) ?? zone.format);

    // ^FB must come AFTER the font command and BEFORE ^FD, otherwise ZPL
    // ignores the wrap and long text overflows the label.
    if (zone.maxWidthDots !== undefined) {
      const justify = zone.justify === "C" ? "C" : zone.justify === "R" ? "R" : "L";
      commands.push(`^FB${zone.maxWidthDots},${zone.maxLines ?? 2},0,${justify},0`);
    }

    commands.push(`^FO${zone.x},${zone.y}`, `^FD${text}^FS`);
  }

  commands.push("^XZ");
  return commands.join("\n");
}

export function buildZpl(template: LabelTemplate, data: LabelData): string {
  const { zones, plan } = resolveLabel(template, data);
  return emit(template, zones, data, plan);
}

/**
 * Genera N copias de la misma etiqueta en un unico trabajo de impresion.
 *
 * Cada copia es un bloque `^XA ... ^XZ` completo, que es como la Zebra delimita una
 * etiqueta: el spooler las cuenta como N etiquetas de un solo job.
 *
 * Se manda todo junto en vez de N jobs por dos razones: una sola ida y vuelta al
 * spooler, y una impresion atomica (si algo falla, no sale la mitad del lote).
 */
export function buildZplBatch(template: LabelTemplate, data: LabelData, qty: number): string {
  const copies = Math.max(1, Math.floor(qty));
  if (copies === 1) return buildZpl(template, data);
  const one = buildZpl(template, data);
  return one.repeat(copies);
}
