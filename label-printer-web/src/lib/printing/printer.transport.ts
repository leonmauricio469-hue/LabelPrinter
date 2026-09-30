import "server-only";
import type { PrinterSettings } from "../settings/settings.types";
import type { PrintResult } from "./printer.types";
import { sendZpl } from "./tcp.transport";
import { sendZplUsb } from "./usb.transport";

export interface PrinterTransport {
  send(zpl: string): Promise<PrintResult>;
}

export function createPrinterTransport(settings: PrinterSettings): PrinterTransport {
  if (settings.transport === "usb") {
    return {
      send(zpl) {
        return sendZplUsb(settings.printerName, zpl);
      },
    };
  }

  return {
    send(zpl) {
      return sendZpl(settings.host, settings.port, zpl);
    },
  };
}