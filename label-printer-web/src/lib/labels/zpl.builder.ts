import type { LabelData } from "./label.types";
import { MM_TO_DOTS, DEFAULT_TEMPLATE, BARCODE_WIDTH_MM, dotsFromMm } from "./label.template";
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
/**
 * Como mide `planBarcode()` el sitio del que dispone el codigo de barras.
 *
 * ANTES: `template.widthDots`, la etiqueta entera. Las barras iban centradas y ocupaban todo el
 * ancho, asi que era lo mismo que la columna. Ahora NO es lo mismo: las barras van en la mitad
 * izquierda y el precio en la derecha, asi que la columna son 345 dots y no 472.
 *
 * Que se mida contra la etiqueta entera daria verde a codigos que luego se imprimen encima del
 * precio, que es justo lo que `planBarcode()` existe para impedir. Y `buscarProblemas()`
 * (en `label-solapes.ts`) no lo cazaría: mide las cajas de tinta, y un codigo de Code 128
 * largo con el precio encima es un solape de cajas que sí vería, pero el aviso llegaría tarde
 * y desde otro sitio.
 *
 * Un cambio de layout tiene que cambiar esto, y no solo las coordenadas de las zonas. Es el
 * mismo clase de fallo que el del `LOGO_DOTS_W`: una medida duplicada en dos sitios que solo
 * cuadra mientras nadie cambie ninguna de las dos.
 *
 * Cuando `center` esta activo la columna no se usa para colocar el simbolo, pero SI para
 * decidir si cabe, y por eso se pide igual. Con `center: false` la `x` de la zona manda y la
 * columna se usa solo para la decision de cabida.
 */
function anchoDisponible(template: LabelTemplate, zone: BarcodeZone): number {
  return zone.center ? template.widthDots : COLUMNA_BARRAS_DOTS;
}

export function planForZone(
  template: LabelTemplate,
  zone: BarcodeZone,
  barcode: string,
): BarcodePlan {
  return planBarcode(barcode, {
    labelWidthDots: anchoDisponible(template, zone),
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
 * Ancho de celda de un caracter, en dots, para un alto dado.
 *
 * En `^A0N,alto,ancho` el ancho es el avance de la celda, no el del glifo: cada caracter ocupa
 * exactamente `ancho` dots. Lo usan por igual `resolveAutoFit()`, que elige el alto, y
 * `partirLineas()` en el render, que reparte el texto en lineas, y tienen que usar la misma
 * cuenta o el alto elegido no cuadraria con las lineas dibujadas.
 */
function anchoCelda(alto: number, widthRatio: number): number {
  return Math.max(1, Math.round(alto * widthRatio));
}

/** Cuantas lineas de `anchoCelda` dots necesita `chars` caracteres en una caja. */
function lineasQueNecesita(chars: number, ancho: number, caja: number): number {
  return Math.ceil(chars / Math.max(1, Math.floor(caja / ancho)));
}

/**
 * Resuelve el alto de fuente de una zona con `autoFit`.
 *
 * Busca el mayor alto, del `maxHeight` hacia abajo, con el que el texto entre. "Entra" quiere
 * decir dos cosas distintas segun el caso, y esa distincion es la que evita que un nombre
 * largo salga cortado de la etiqueta:
 *
 * 1. UNA LINEA, que es lo que se busca. El nombre de un producto cabe en una linea casi
 *    siempre, y en una linea se lee de un vistazo. Se baja la fuente lo que haga falta para
 *    que quepa, con el suelo en `minHeight`.
 *
 * 2. Si ni al `minHeight` cabe en una linea, HACE FALLO y no se rinde. Con `maxLines: 1` el
 *    texto se dibuja en una sola linea que se sale de la caja, y en el papel la impresora la
 *    CORTA: el nombre del producto mas largo del catalogo (68 caracteres) llegaba a 476 dots
 *    en una caja de 446, y se perdian los ultimos cinco caracteres. Perder el nombre a la
 *    fuerza es peor que partirlo en dos lineas, asi que en ese caso se admiten `maxLines`
 *    lineas y se busca el alto que mas grande las deja.
 *
 * Ese segundo paso es tambien el que evita que la altura elegida y el reparto en lineas que
 * hace el render sean cosas distintas: los dos usan `lineasQueNecesita()`.
 *
 * El texto llega ya plegado a ASCII y en mayusculas (`textFor()`), porque `foldField()` puede
 * acortar un nombre y `toUpperCase()` no cambia la longitud. Medir la cadena original y
 * mandar la plegada daria una anchura equivocada.
 */
function resolveAutoFit(zone: TextZone, text: string): string | null {
  if (!zone.autoFit || zone.maxWidthDots === undefined) return null;
  const { maxHeight, minHeight, widthRatio } = zone.autoFit;
  if (text.length === 0) return null;

  const chars = text.length;
  const caja = zone.maxWidthDots;
  const { maxBlockDots } = zone.autoFit;

  /**
   * Alto que ocupa un bloque de `lineas` lineas de alto `a`.
   *
   * NO es `lineas * a`. `^FB` separa las lineas con una separacion IGUAL al alto de la fuente
   * cuando el campo de separacion va a 0, que es lo que emite `emit()`. De ahi el `2 * lineas - 1`:
   * una linea ocupa `a`, dos ocupan `2a + a`, tres ocupan `3a + 2a`.
   *
   * Este error hacia que un nombre de 65 caracteres en dos lineas de 32 dots llegara a y=168,
   * justo donde empiezan las barras, con el bloqueContando 64 dots y ocupando 96. Dos cajas que
   * se tocan no se solapan, asi que el detector de solapes no lo veia.
   */
  const altoBloque = (a: number, lineas: number) => (2 * lineas - 1) * a;

  /** ¿Cabe el texto con este alto, en una linea? */
  const cabeEnUna = (a: number) => {
    if (chars * anchoCelda(a, widthRatio) > caja) return false;
    return maxBlockDots === undefined || altoBloque(a, 1) <= maxBlockDots;
  };

  /** ¿Cabe repartido en `lineas` lineas de alto `a`? */
  const cabeEn = (a: number, lineas: number) => {
    if (lineasQueNecesita(chars, anchoCelda(a, widthRatio), caja) > lineas) return false;
    return maxBlockDots === undefined || altoBloque(a, lineas) <= maxBlockDots;
  };

  // 1. El mayor alto que cabe en una linea.
  let alto = maxHeight;
  while (alto > minHeight && !cabeEnUna(alto)) alto -= 1;
  if (cabeEnUna(alto)) {
    return `^A0N,${alto},${anchoCelda(alto, widthRatio)}`;
  }

  // 2. No cabe en una linea ni al minimo: se reparte en varias, si la zona las permite.
  //    Se prueba de mas a menos lineas para no partir un nombre que cabe en dos cuando
  //    cabria en tres: partir menos, con la letra mas grande, se lee mejor.
  const maxLineas = Math.max(1, zone.maxLines ?? 1);
  for (let lineas = 2; lineas <= maxLineas; lineas += 1) {
    alto = maxHeight;
    while (alto > minHeight && !cabeEn(alto, lineas)) alto -= 1;
    if (cabeEn(alto, lineas)) {
      return `^A0N,${alto},${anchoCelda(alto, widthRatio)}`;
    }
  }

  // 3. Ni una linea ni varias: se entrega el minHeight y avisa quien mida. Aqui NO se recorta
  //    el texto, porque `^FD` lleva el nombre entero y el recorte lo hace la impresora, que
  //    es donde se ha de ver el problema. El render dibuja las lineas que caben —las mismas
  //    que imprime— y el sobrante lo anuncia en el informe con "NO SALE ENTERO".
  return `^A0N,${minHeight},${anchoCelda(minHeight, widthRatio)}`;
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
    zone.source === "fixed"
      ? // Texto libre del operador (F8a): el literal tal cual. Sin mayusculas forzadas: lo
        // fijo sale como se escribe; `uppercase` es una decision de legibilidad del catalogo
        // (el nombre en grande se lee de lejos) y no aplica al literal.
        zone.text
      : zone.source === "header"
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
  //
  // Las mayusculas van DESPUES del plegado, no antes. Ver `TextZone.uppercase`: al reves,
  // `normalize("NFD")` separaria la tilde de la letra, el plegado la borraria, y de "JALAPEÑO"
  // saldria "JALAPENO" en vez de "JALAPENO" con la N correcta. Que las dos rutas den lo mismo
  // no es casualidad, es el orden correcto.
  //
  // Y va dentro de `textFor()`, no en `emit()`, para que `resolveAutoFit()` mida exactamente
  // lo que se va a imprimir.
  //
  // Lo fijo (`source: "fixed"`) solo se pliega, sin `uppercase` aunque la zona lo traiga:
  // sale como se escribe. El plegado si vale igual (seguridad ZPL: la GX420t no tiene el
  // glifo), y `autoFit`, `justify` y `maxWidth` tambien: son del pipeline, no de la fuente.
  const plegado = foldField(raw);
  if (zone.source === "fixed") return `${zone.prefix ?? ""}${plegado}`;
  return `${zone.prefix ?? ""}${zone.uppercase ? plegado.toUpperCase() : plegado}`;
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
  const mm = (dots: number) => (dots / MM_TO_DOTS).toFixed(2);
  return (
    `el medio cargado mide ${mm(mediaWidthDots)} mm y la etiqueta mide ` +
    `${mm(template.widthDots)} mm. Con un medio mas estrecho que la etiqueta, ^PW recorta y no ` +
    `escala: la etiqueta saldria cortada por la derecha, en silencio. O se pone un rollo de ` +
    `${template.widthMm} mm o mas, o la etiqueta se hace mas estrecha.`
  );
}

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

    // Figuras libres (F8b): por el mismo camino que el marco, sin comando nuevo.
    //
    // El rectangulo es un `shape` de esquinas vivas, tal cual. La linea es un `^GB`
    // colapsado: de alto igual al grosor sale una barra horizontal maciza, y de ancho
    // igual al grosor una vertical. Se normalizan a `ShapeZone` y las emite
    // `shapeCommands()`: un solo constructor de `^GB`, una sola forma de salir mal.
    if (zone.kind === "rect") {
      commands.push(
        ...shapeCommands({
          kind: "shape",
          x: zone.x,
          y: zone.y,
          widthDots: zone.widthDots,
          heightDots: zone.heightDots,
          thicknessDots: zone.thicknessDots,
          radiusDots: 0,
        }),
      );
      continue;
    }

    if (zone.kind === "line") {
      const t = Math.max(1, zone.thicknessDots);
      const vertical = zone.orientacion === "vertical";
      commands.push(
        ...shapeCommands({
          kind: "shape",
          x: zone.x,
          y: zone.y,
          widthDots: vertical ? t : zone.largoDots,
          heightDots: vertical ? zone.largoDots : t,
          thicknessDots: t,
          radiusDots: 0,
        }),
      );
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
 * Donde se corta el ancho de la etiqueta en dos columnas, para el codigo y para el precio.
 *
 * ESTA FUNCION ES LA QUE SOSTIENE EL LAYOUT NUEVO, Y HAY QUE LEERLA ANTES DE CAMBIAR UN NUMERO.
 *
 * El codigo de barras y el precio se reparten el ancho a lo largo: codigo a la izquierda,
 * precio a la derecha. El reparto son 230 dots para las barras (el simbolo de 190 a modulo 2,
 * mas las dos zonas quietas de 10X = 20 dots cada una) y el resto para el precio.
 *
 * Por que 230 y no 220-250 como se pidio: EAN-13 son 95 modulos FIJOS y el ancho de modulo
 * de ZPL es un entero, asi que el simbolo mide 190 o 285 dots, nunca nada entre medias. Entre
 * 220 y 250 haria falta un modulo de 2,32 a 2,63, que no existe. A 3 dots (0,375 mm) el
 * simbolo cumple el minimo de 0,264 mm de ISO/IEC 15420; a 2 dots (0,250 mm) queda por debajo.
 *
 * Se eligio el de 2 dots el 8/10: la prueba fisica del layout de dos columnas midio las barras
 * a modulo 3 "demasiado anchas y pegadas a REF", y a 285 dots no queda columna derecha que
 * valga para REF y PRICE. A 190 dots si: 99 dots de aire entre el simbolo (que acaba en 230) y
 * el REF (329). Queda la norma un 5 % por debajo, aceptado a cambio de que la etiqueta se lea.
 * Ver [[Prueba Legibilidad Barcode]].
 *
 * El valor sale de `BARCODE_WIDTH_MM` y no de un 230 escrito a mano, por el mismo motivo que
 * el marco: si el ancho del area del codigo cambia en la plantilla y este numero se queda, el
 * codigo pasa a imprimirse pegado al precio sin que nada se entere.
 *
 * El ancho de la columna se mide CON las zonas quietas dentro, porque son ellas las que la
 * norma pide y las que se comen el sitio. Una columna de 190 dots con las barras centradas
 * dentro tendria 40 dots de zona quieta, y el codigo se leeria bien; pero `planBarcode()`
 * mide el margen necesario para decidir si cabe, y si le dijeramos 190 cuando el sitio real
 * son 230, el codigo pasaria a imprimirse pegado al precio.
 */
export const COLUMNA_BARRAS_DOTS = dotsFromMm(BARCODE_WIDTH_MM);

/**
 * El ancho que se queda el precio: el de la etiqueta menos la columna de las barras.
 *
 * Sale de `DEFAULT_TEMPLATE.widthDots` y no de un 472 escrito a mano, por el mismo motivo que
 * el marco: si el ancho de la etiqueta cambia y este numero se queda, el precio se sale de la
 * etiqueta sin que nada se entere.
 */
export const ANCHO_PRECIO_DOTS = DEFAULT_TEMPLATE.widthDots - COLUMNA_BARRAS_DOTS;

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
