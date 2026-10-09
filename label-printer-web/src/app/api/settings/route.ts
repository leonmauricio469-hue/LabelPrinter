import { NextResponse } from "next/server";
import { readSettings, writeSettings } from "@/lib/settings/settings.store";
import { updateSettingsSchema } from "@/lib/validation/schemas";

export async function GET() {
  const settings = await readSettings();
  return NextResponse.json(settings);
}

export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  // F11: PUT parcial con validacion completa. Se lee lo guardado, se mezcla lo
  // que trae el cuerpo (a dos niveles, igual que `readSettings()`) y se valida
  // el resultado ENTERO. Asi el slider de densidad puede mandar `{ oscuridad }`
  // sin reescribir el resto, y un cuerpo con un campo roto sigue siendo 400.
  const actual = await readSettings();
  const parcial = body as Partial<Record<string, unknown>>;
  const mezclado = {
    ...actual,
    ...parcial,
    printer: {
      ...actual.printer,
      ...((parcial.printer as Record<string, unknown> | undefined) ?? {}),
    },
    label: {
      ...actual.label,
      ...((parcial.label as Record<string, unknown> | undefined) ?? {}),
    },
  };

  const parsed = updateSettingsSchema.safeParse(mezclado);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Configuracion invalida", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await writeSettings(parsed.data);
  return NextResponse.json(parsed.data);
}