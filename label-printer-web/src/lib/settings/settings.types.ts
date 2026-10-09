import { DEFAULT_TEMPLATE_ID } from "@/lib/labels/label.template";

export type PrinterTransportKind = "tcp" | "usb";

export interface PrinterSettings {
  /** "tcp" = socket 9100 (impresora de red), "usb" = cola local de Windows */
  transport: PrinterTransportKind;
  /** host de la impresora de red, usado solo si transport = "tcp" */
  host: string;
  /** puerto de la impresora de red, usado solo si transport = "tcp" */
  port: number;
  /** nombre de la cola de Windows, usado solo si transport = "usb" */
  printerName: string;
  /**
   * Ancho del MEDIO cargado en la impresora, en mm. No es el ancho de la etiqueta.
   *
   * Son dos cosas distintas y confundirlas cuesta caro:
   *
   * - El **medio** es el rollo de papel. Lo pone la persona, en la impresora, y no se cambia
   *   desde la app. Es lo unico que decide `^PW`.
   * - El **diseño** es la etiqueta que dibuja `label.template.ts`, con sus zonas en dots. Es
   *   de donde sale el centrado del barcode, la zona quieta y la posicion del marco.
   *
   * Solo el medio va aqui. Si se metiera tambien en la plantilla, el barcode se centraria
   * sobre el medio en vez de sobre el diseño, y la zona quieta se mediria contra el canto
   * del rollo en vez de contra el borde de la etiqueta, que son dos medidas que ya no
   * dirian la verdad de la zona quieta.
   *
   * OJO con lo que pasa si esto es MENOR que el diseño: `^PW` recorta, no escala. El ZPL
   * sigue siendo valido y la impresora no protesta, pero la etiqueta sale con el lado
   * derecho cortado y sin ningun aviso. Por eso `api/labels` se niega a imprimir en ese
   * caso, y `/settings` lo dice mientras se escribe.
   *
   * Si es MAYOR, el diseño sale pegado al borde izquierdo y el sobrante se queda en blanco a
   * la derecha. Se imprime entero, que es lo importante; lo de centrarlo todavia no se hace.
   */
  mediaWidthMm: number;
}

export interface LabelSettings {
  widthMm: number;
  heightMm: number;
  businessName: string;
  /**
   * Que plantilla imprime. Es el id de `TEMPLATES`, no el objeto: la plantilla vive en el
   * codigo y `settings.json` solo guarda cual se quiere.
   *
   * Antes de existir esto, `api/labels/route.ts` usaba `DEFAULT_TEMPLATE` fijo y `widthMm` y
   * `heightMm` no los leia nadie. Cambiarlos en /settings no hacia nada. Aqui el id va de
   * verdad: cambiar de plantilla cambia los dots que salen, que es lo que se queria.
   *
   * `widthMm` y `heightMm` se conservan por compatibilidad, pero ya NO son la fuente de la
   * medida: la medida sale de la plantilla. /settings avisa de eso.
   */
  templateId: string;
}

export interface AppSettings {
  printer: PrinterSettings;
  label: LabelSettings;
  /**
   * Densidad termica para `~SD` (F11). Cadena vacia = comportamiento actual:
   * no se antepone nada al ZPL y la impresora usa su ajuste fisico.
   *
   * Es cadena y no numero a proposito: "vacio" tiene que ser un valor valido y
   * distinto de cualquier densidad, incluido el 0. Solo valen "" o 0-30
   * (lo impone `updateSettingsSchema`).
   */
  oscuridad: string;
  /** Beep WebAudio al imprimir bien (F11). Sin pagina de prueba: los toggles van en F12. */
  sonidoOk: boolean;
  /** Beep WebAudio al fallar (F11). Sin pagina de prueba: los toggles van en F12. */
  sonidoError: boolean;
  /**
   * Ventana anti-duplicados en ms (F11). 0 = apagada. Con valor > 0, repetir el
   * mismo codigo dentro de la ventana no imprime: avisa "duplicado ignorado".
   */
  ventanaDuplicadosMs: number;
  /**
   * Ventana idle del scanner USB en ms (F11). Es el `IDLE_RESET_MS` de
   * `scanner-input.tsx`, que antes era una constante de 500.
   */
  retardoEscanerMs: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  printer: {
    transport: "tcp",
    host: "127.0.0.1",
    port: 9100,
    printerName: "ZDesigner GX420t",
    // 59 mm, que es lo que mide la plantilla. Es una suposicion, no un dato medido: el valor
    // real es el del rollo que haya puesto la persona, y por eso es editable en /settings.
    // Mientras sea menor que la plantilla, la app se niega a imprimir (ver `PrinterSettings`).
    mediaWidthMm: 59,
  },
  label: {
    // Valores de una etiqueta de 59 x 35 mm. Ya no son la fuente de la medida (esa sale de
    // la plantilla), pero se mise ahi para que un `settings.json` viejo, escrito cuando la
    // unica medida era la de settings, no abra en 50 mm y mande a medir la impresora con el
    // rollo equivocado.
    widthMm: 59,
    heightMm: 35,
    businessName: "PA PICAR",
    templateId: DEFAULT_TEMPLATE_ID,
  },
  // F11. `oscuridad` vacia = la impresora manda, como siempre. Sonidos ON por
  // defecto: el operador ya miraba el cartel, el beep solo lo acompana.
  // Duplicados OFF por defecto: con 0 nada cambia respecto a hoy.
  // `retardoEscanerMs` 500 = la constante que ya habia en `scanner-input.tsx`.
  oscuridad: "",
  sonidoOk: true,
  sonidoError: true,
  ventanaDuplicadosMs: 0,
  retardoEscanerMs: 500,
};