import type { PrinterSettings } from "../settings/settings.types";
import type { QueueStatus } from "./queue.status.types";

/**
 * The printer status for the transport that actually receives the labels.
 *
 * Before, the status route always read the Windows queue named in the settings, even with
 * TCP selected: it could show a USB queue as ready while labels went to a network printer.
 * TCP on port 9100 has no status channel here, so it says so and names the destination,
 * instead of borrowing another printer's status.
 */
export async function statusForTransport(
  printer: PrinterSettings,
  readQueue: (printerName: string) => Promise<QueueStatus>,
): Promise<QueueStatus> {
  if (printer.transport === "usb") return readQueue(printer.printerName);

  const destination = `${printer.host}:${printer.port}`;
  return {
    state: "unknown",
    message: `Impresora de red ${destination}: el estado fisico (papel, cinta, pausa) no se puede consultar por TCP`,
    jobCount: 0,
    checkedAt: new Date().toISOString(),
    raw: { queue: destination, found: false, statusFlags: null, statusText: null, port: destination, driver: null },
    error: null,
  };
}
