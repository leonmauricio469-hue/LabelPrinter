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

/**
 * Texto y fuente que realmente salen de una zona de texto, con unos datos concretos.
 *
 * Es lo mismo que hace `emit()`, pero sin emitir: devuelve el `format` que se acabaria
 * mandando a la impresora y el texto ya plegado. Lo usa el editor de `/editor` para ensenar
 * el alto RESUELTO y no el techo.
 *
 * Esa distincion importa. Con `autoFit`, `format` es el valor por defecto y no se imprime si
 * el texto no cabe: `resolveAutoFit()` busca un alto menor. Enseñar `format` como si fuera
 * el alto real daria un numero que nunca sale en el papel.
 *
 * Devuelve `null` si la zona no imprime nada con esos datos (texto vacio), que es lo mismo
 * que hace `emit()` al saltarsela.
 */
export function resolveZoneText(
  template: LabelTemplate,
  zone: TextZone,
  data: LabelData,
): { text: string; format: string; alto: number; ancho: number } | null {
  const bz = barcodeZoneOf(template);
  const plan: BarcodePlan = bz
    ? planForZone(template, bz, data.barcode)
    : { printable: false, reason: "vacio", detail: "la plantilla no tiene zona de codigo" };
  const text = textFor(zone, data, plan);
  if (text === "") return null;
  const format = resolveAutoFit(zone, text) ?? zone.format;
  const m = format.match(/\^A0N,(\d+),(\d+)/);
  return {
    text,
    format,
    alto: m ? Number.parseInt(m[1], 10) : 0,
    ancho: m ? Number.parseInt(m[2], 10) : 0,
  };
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

/**
 * Que el medio admita el diseño, o por que no.
 *
 * ESTE ES EL FALLO QUE MAS CARO SALIA, Y NO AVISABA
 *
 * `^PW` no escala: recorta. Si el rollo es de 50 mm y la etiqueta de 59, `^PW400` recorta
 * todo lo que pase de 400 dots, el ZPL sigue siendo valido, la impresora no
 * protesta, el trabajo sale de la cola como bien entregado, y lo que sale por el otro lado es
 * una etiqueta a la que le falta un trozo por la derecha. Sin barras, sin el precio entero, o
 * con el marco cortado.
 *
 * Un recorte asi no se ve en la previsualizacion, porque la previsualizacion dibuja el
 * diseño, no el medio. Y no se ve en el ZPL, porque el ZPL no dice "he recortado": dice los
 * numeros que le han dado. Solo se ve en el papel, que es donde no se puede mirar antes de
 * gastar.
 *
 * Asi que se comprueba aqui, en el sitio que decide `^PW`, y se devuelve un texto para poder
 * negarse. Devolver el motivo y no un booleano es a proposito: el que se niega tiene que
 * poder enseñarle a la persona el numero que hay que cambiar.
 *
 * Cuando el medio es MAYOR que el diseño no dice nada. Sale entero, que es lo que importa, y
 * el sobrante se queda en blanco a la derecha porque el diseño va anclado a la izquierda.
 */
export function problemaDeMedio(
  template: LabelTemplate,
  mediaWidthDots: number,
): string | null {
  if (mediaWidthDots >= template.widthDots) return null;
  const mm = (dots: number) => (dots / DOTS_POR_MM).toFixed(2);
  return (
    `el medio cargado mide ${mm(mediaWidthDots)} mm y la etiqueta mide ` +
    `${mm(template.widthDots)} mm. Con un medio mas estrecho que la etiqueta, ^PW recorta y no ` +
    `escala: la etiqueta saldria cortada por la derecha, en silencio. O se pone un rollo de ` +
    `${template.widthMm} mm o mas, o la etiqueta se hace mas estrecha.`
  );
}

/** Dots por mm a 203 dpi, que es lo que usa `label.template.ts`. */
const DOTS_POR_MM = 8;

function emit(
  template: LabelTemplate,
  zones: LabelZone[],
  data: LabelData,
  plan: BarcodePlan,
  mediaWidthDots: number,
): string {
  const commands: string[] = [
    "^XA",
    // `^PW` es el medio, no el diseño. Ver `problemaDeMedio()`, que explica por que esto no es
    // intercambiable y por que el error sale sin avisar.
    `^PW${mediaWidthDots}`,
    // `^LL` es la longitud de etiqueta, que es una medida del diseno: es cuanto avanza el
    // papel entre etiquetas, y tiene que ser el alto de la etiqueta aunque el rollo sea mas
    // largo, porque el rollo se corta a mano.
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

/**
 * Opciones de construccion del ZPL.
 *
 * `mediaWidthDots` es el ancho del rollo en dots, y sale de `/settings`. Si no se pasa, vale el
 * ancho del diseño, que es lo que quieren el editor y las pruebas: ambas dibujan la etiqueta,
 * no el medio.
 */
export interface BuildOpciones {
  /** Ancho del medio en dots. Por defecto, el ancho del diseño. */
  mediaWidthDots?: number;
}

export function buildZpl(
  template: LabelTemplate,
  data: LabelData,
  opts: BuildOpciones = {},
): string {
  const { zones, plan } = resolveLabel(template, data);
  return emit(template, zones, data, plan, opts.mediaWidthDots ?? template.widthDots);
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
export function buildZplBatch(
  template: LabelTemplate,
  data: LabelData,
  qty: number,
  opts: BuildOpciones = {},
): string {
  const copies = Math.max(1, Math.floor(qty));
  if (copies === 1) return buildZpl(template, data, opts);
  const one = buildZpl(template, data, opts);
  return one.repeat(copies);
}
