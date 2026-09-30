import { NextResponse } from "next/server";
import { readSettings } from "@/lib/settings/settings.store";
import { testConnection } from "@/lib/printing/tcp.transport";
import { testUsbConnection } from "@/lib/printing/usb.transport";

export async function POST() {
  let settings;
  try {
    settings = await readSettings();
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
  const result =
    settings.printer.transport === "usb"
      ? await testUsbConnection(settings.printer.printerName)
      : await testConnection(settings.printer.host, settings.printer.port);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}