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

  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Configuracion invalida", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await writeSettings(parsed.data);
  return NextResponse.json(parsed.data);
}