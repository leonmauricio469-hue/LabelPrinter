import { NextResponse } from "next/server";
import { readSettings } from "@/lib/settings/settings.store";
import { dotsFromMm } from "@/lib/labels/label.template";
import { createPrinterTransport } from "@/lib/printing/printer.transport";

/**
 * Imprime UNA etiqueta de diagnostico en la GX420.
 *
 * Es hardware, no una venta: no valida producto, no mira catalogo y NO audita
 * en el historial. Gasta 1 etiqueta de verdad.
 *
 * El ZPL se construye aqui, minimo y a mano, solo con comandos ya probados en
 * el proyecto (`zpl.builder.ts` los emite todos: `^XA ^PW ^FO ^A0N ^FD ^FS
 * `^GB ^XZ`):
 *
 *   - `^PW` sale del `mediaWidthMm` de settings, que es el rollo que hay
 *     puesto, no el diseño. Igual que en la impresion normal.
 *   - `^A0N` con "PRUEBA GX420" + timestamp ISO del servidor (solo ASCII:
 *     digitos, `T`, `:`, `-`, `.`, `Z`; sin `^` ni `~` que romperian el `^FD`).
 *   - Tres barras con `^GB` en la forma que emite `shapeCommands()`
 *     (`^GBw,h,t,B,0,0`): con grosor igual a la altura la caja sale maciza y
 *     se ve si hay lineas blancas (cabezal sucio) o huecos.
 */
export async function POST() {
  const settings = await readSettings();
  const mediaDots = dotsFromMm(settings.printer.mediaWidthMm);

  const ts = new Date().toISOString().replace(/[^0-9T:\-.Z]/g, "");
  // Las barras no se salen del medio: 20 dots de margen a cada lado.
  const lineW = Math.max(50, mediaDots - 40);

  const zpl = [
    "^XA",
    `^PW${mediaDots}`,
    "^FO20,20",
    "^A0N,40,32",
    "^FDPRUEBA GX420^FS",
    "^FO20,75",
    "^A0N,24,20",
    `^FD${ts}^FS`,
    "^FO20,120",
    `^GB${lineW},4,4,B,0,0^FS`,
    "^FO20,132",
    `^GB${lineW},2,2,B,0,0^FS`,
    "^FO20,142",
    `^GB${lineW},4,4,B,0,0^FS`,
    "^XZ",
  ].join("\n");

  // Misma via que POST /api/labels: la que diga el transporte configurado.
  const destino =
    settings.printer.transport === "usb"
      ? settings.printer.printerName
      : `${settings.printer.host}:${settings.printer.port}`;

  try {
    const transport = createPrinterTransport(settings.printer);
    const result = await transport.send(zpl);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "La impresora no respondio" },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      printedAt: new Date().toISOString(),
      transport: settings.printer.transport,
      destino,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 502 });
  }
}
