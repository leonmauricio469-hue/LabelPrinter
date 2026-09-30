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
    widthMm: 50,
    heightMm: 25,
    businessName: "PA PICAR",
  },
};