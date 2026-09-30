import { NextResponse } from "next/server";
import { readSettings, writeSettings } from "@/lib/settings/settings.store";
import { updateSettingsSchema } from "@/lib/validation/schemas";
import { crossSiteRejection } from "@/lib/http/same-origin";

export async function GET() {
  try {
    return NextResponse.json(await readSettings());
  } catch (err) {
    // Un settings.json invalido se explica, no se tapa con los valores por defecto: ver
    // settings.file.ts. La pantalla muestra este mensaje con un boton de reintento.
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const rejected = crossSiteRejection(req);
  if (rejected) return NextResponse.json({ error: rejected.error }, { status: rejected.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Configuracion invalida", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    await writeSettings(parsed.data);
  } catch (err) {
    // Un guardado fallido se explica en JSON, igual que un error de lectura (R4-004).
    return NextResponse.json(
      { error: `No se pudo guardar settings.json: ${(err as Error).message}` },
      { status: 500 },
    );
  }
  return NextResponse.json(parsed.data);
}