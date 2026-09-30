import type { LabelData } from "./label.types";
import type { LabelTemplate, BarcodeZone, LabelZone, TextZone } from "./label.template";
import { planBarcode, barcodeFormat, QUIET_FACTOR } from "./barcode-plan";
import type { BarcodePlan } from "./barcode-plan";

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
 * en 269 de los 3080 productos del catalogo real, y eso parece una etiqueta rota. Con
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

function textFor(zone: TextZone, data: LabelData): string {
  const raw =
    zone.source === "header"
      ? (zone.header ?? data.businessName)
      : zone.source === "price"
        ? data.price.toFixed(2)
        : String(data[zone.source]);
  return `${zone.prefix ?? ""}${raw}`;
}

/**
 * Un `^FD` que ningun dato puede romper.
 *
 * `^` y `~` son los prefijos de comando de ZPL: sin escapar, un nombre como "CAFE^FS^XZ"
 * cierra el campo y la etiqueta, y un "~JA" cancela todos los trabajos de la impresora.
 * `^FH\` hace que la impresora decodifique `\hh` como un byte, asi que se escapan esos dos
 * y la propia barra. Los saltos de linea no significan nada en `^FD` y se vuelven espacios.
 */
function fieldCommand(value: string): string {
  const escaped = value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\\^~]/g, (c) => `\\${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `^FH\\^FD${escaped}^FS`;
}

/**
 * Ajusta un texto a `maxLines` lineas de `perLine` caracteres, cortando por palabras.
 *
 * `^FB` ajusta el texto en la impresora, pero lo que no entra en las lineas previstas lo
 * SUPERPONE en la ultima (documentado por Zebra): un nombre largo salia ilegible, encimado.
 * Aqui se hace el mismo ajuste antes, con el ancho nominal de la fuente, y si no entra se
 * corta con "..." explicito. El ancho nominal es el de las letras anchas, asi que es
 * conservador: si entra aqui, entra en el papel.
 */
export function fitText(text: string, perLine: number, maxLines: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
    .flatMap((w) => w.match(new RegExp(`.{1,${perLine}}`, "g")) ?? []);
  const lines: string[] = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last !== undefined && last.length + 1 + word.length <= perLine) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else {
      lines.push(word);
    }
  }
  if (lines.length <= maxLines) return lines.join(" ");

  const kept = lines.slice(0, maxLines);
  const lastLine = kept[maxLines - 1];
  kept[maxLines - 1] = `${lastLine.slice(0, Math.max(0, perLine - 3)).trimEnd()}...`;
  return kept.join(" ");
}

/** Ancho nominal de caracter de un `^A0N,alto,ancho`. */
function charWidth(format: string): number | null {
  const m = /^\^A0N,\d+,(\d+)/.exec(format);
  return m ? Number(m[1]) : null;
}

function emit(template: LabelTemplate, zones: LabelZone[], data: LabelData, plan: BarcodePlan): string {
  const commands: string[] = [
    "^XA",
    // UTF-8 para los textos: el catalogo tiene Ñ, tildes y Ç, y sin `^CI` la impresora usa
    // su pagina de codigos por defecto. Los transportes envian UTF-8 (ver `zplPayload`).
    "^CI28",
    `^PW${template.widthDots}`,
    `^LL${template.heightDots}`,
    "^LH0,0",
  ];

  for (const zone of zones) {
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
        barcodeFormat(plan, zone.heightDots, zone.interpretationLine),
        `^FO${barcodeX(template, zone, plan)},${zone.y}`,
        fieldCommand(plan.fieldData),
      );
      continue;
    }

    const w = charWidth(zone.format);
    const text =
      zone.maxWidthDots !== undefined && w
        ? fitText(textFor(zone, data), Math.floor(zone.maxWidthDots / w), zone.maxLines ?? 2)
        : textFor(zone, data);
    commands.push(zone.format);

    // ^FB must come AFTER the font command and BEFORE ^FD, otherwise ZPL
    // ignores the wrap and long text overflows the label.
    if (zone.maxWidthDots !== undefined) {
      const justify = zone.justify === "C" ? "C" : zone.justify === "R" ? "R" : "L";
      commands.push(`^FB${zone.maxWidthDots},${zone.maxLines ?? 2},0,${justify},0`);
    }

    commands.push(`^FO${zone.x},${zone.y}`, fieldCommand(text));
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
