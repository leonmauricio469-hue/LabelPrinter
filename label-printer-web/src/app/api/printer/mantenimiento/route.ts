import { NextResponse } from "next/server";
import { z } from "zod";
import { readSettings } from "@/lib/settings/settings.store";
import { createPrinterTransport } from "@/lib/printing/printer.transport";

/**
 * `POST /api/printer/mantenimiento`: `{ accion: "feed" | "calibrar" }`.
 *
 * Ruta delgada de hardware, no una venta: no valida producto, no mira catalogo
 * y NO audita en el historial (igual que `POST /api/printer/test-print`).
 * Gasta papel de verdad: Avanzar 1 etiqueta, Calibrar de 1 a 4.
 *
 * Comandos oficiales Zebra (documentacion primaria):
 *
 * - Avanzar 1 (`feed`): `~PH` suelto, FUERA de `^XA`/`^XZ`. Avanza una etiqueta
 *   en blanco. Riesgo minimo.
 * - Calibrar gap (`calibrar`): `~JC` suelto, FUERA de bloque, seguido de
 *   `^XA^JUS^XZ` para guardar la calibracion (`^JUS` = save). La GX420 avanza
 *   de 1 a 4 etiquetas. Riesgo medio-alto si el medio esta mal cargado.
 *
 * Los bytes van verbatim por el mismo `transport.send()` de `POST /api/labels`
 * (igual que `aplicarOscuridad()` antepone `~SD` fuera del primer `^XA`).
 * Efecto EN PAPEL pendiente de prueba fisica en este equipo: la ruta responde
 * lo que dijo el transporte, sin inventar.
 *
 * NO usar `^MF` (politica de arranque, no calibracion bajo demanda).
 */
const bodySchema = z.object({
  accion: z.enum(["feed", "calibrar"], {
    message: "accion debe ser feed o calibrar",
  }),
});

/** Avanza una etiqueta en blanco. */
const ZPL_FEED = "~PH";

/** Calibra el sensor de gap y guarda el resultado. */
const ZPL_CALIBRAR = "~JC\n^XA^JUS^XZ";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Solicitud invalida", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let settings;
  try {
    settings = await readSettings();
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const zpl = parsed.data.accion === "feed" ? ZPL_FEED : ZPL_CALIBRAR;
  const transport = createPrinterTransport(settings.printer);
  try {
    const result = await transport.send(zpl);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "la impresora no respondio" },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, accion: parsed.data.accion });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 502 });
  }
}
