import { NextResponse } from "next/server";
import { readPrintHistory } from "@/lib/audit/audit.store";

/** `GET /api/history?limit=100` — ultimas impresiones, de la mas reciente a la mas antigua. */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("limit");
  const parsed = Number.parseInt(raw ?? "", 10);
  const limit = Number.isFinite(parsed) ? Math.min(500, Math.max(1, parsed)) : 100;

  try {
    return NextResponse.json({ records: await readPrintHistory(limit) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
