import { NextResponse } from "next/server";
import { listWindowsPrinters } from "@/lib/printing/usb.transport";

/**
 * `GET /api/printers` — colas de impresora instaladas en este PC.
 *
 * Solo tiene sentido con `transport: "usb"`. Si la lista falla se responde 200 con
 * `printers: []` y el motivo en `error`: /settings debe poder seguir funcionando
 * escribiendo el nombre de la cola a mano.
 */
export async function GET() {
  const { printers, error } = await listWindowsPrinters();
  return NextResponse.json({ printers, ...(error ? { error } : {}) });
}
