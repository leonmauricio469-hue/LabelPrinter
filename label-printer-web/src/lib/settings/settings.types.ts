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
}

export const DEFAULT_SETTINGS: AppSettings = {
  printer: {
    transport: "tcp",
    host: "127.0.0.1",
    port: 9100,
    printerName: "ZDesigner GX420t",
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
};