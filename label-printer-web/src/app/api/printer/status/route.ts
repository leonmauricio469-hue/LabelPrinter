import { NextResponse } from "next/server";
import { readSettings } from "@/lib/settings/settings.store";
import { readQueueStatus } from "@/lib/printing/queue.status";

/**
 * `GET /api/printer/status`
 *
 * Estado real de la cola de Windows, que es lo unico que el sistema sabe de la impresora sin
 * abrir un canal de comunicacion con ella.
 *
 * Esto **no** es lo mismo que `POST /api/printer/test`. Aquel responde "existe una cola con
 * ese nombre" (solo `OpenPrinter`); este responde si la impresora va a imprimir algo. La
 * diferencia es la que separa "la app imprimio" de "hay papel en la impresora".
 *
 * `?force=1` salta la cache de unos segundos. Sin ese parametro dos navegadores abiertas
 * comparten una sola consulta, que es lo que hace falta: cuesta ~2,3 s.
 *
 * No es un 500 cuando la impresora esta mal: eso es un estado, no un fallo de la API. El
 * 500 se reserva para no poder leer el catalogo de configuracion.
 */
export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("force") === "1";

  let printerName: string;
  try {
    const settings = await readSettings();
    printerName = settings.printer.printerName;
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }

  const status = await readQueueStatus(printerName, { force });
  return NextResponse.json(status);
}
