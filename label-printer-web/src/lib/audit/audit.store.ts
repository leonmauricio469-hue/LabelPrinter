import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = path.resolve(process.cwd(), "data");
const HISTORY_FILE = path.join(DATA_DIR, "print-history.jsonl");

export type PrintMode = "normal" | "fast";

export interface PrintRecord {
  /** ISO-8601, generado al escribir */
  ts: string;
  jobId: string;
  code: string;
  name: string;
  qty: number;
  ok: boolean;
  mode: PrintMode;
  /** motivo del fallo cuando ok = false */
  error?: string;
  /** ID del trabajo en la cola de Windows (solo USB); `jobId` es el de esta auditoria */
  spoolerJobId?: number;
}

/**
 * Agrega una linea al historial. Formato JSON Lines: una impresion por linea, se puede
 * leer con `Get-Content` o con `jq` sin cargar todo el archivo en memoria.
 *
 * Se escribe en modo `append` para no perder el historial si dos impresiones caen a la
 * vez desde pestanas distintas del modo rapido.
 */
export async function appendPrintRecord(
  entry: Omit<PrintRecord, "ts" | "jobId"> & { jobId?: string },
): Promise<PrintRecord> {
  const record: PrintRecord = {
    ts: new Date().toISOString(),
    jobId: entry.jobId ?? randomUUID(),
    code: entry.code,
    name: entry.name,
    qty: entry.qty,
    ok: entry.ok,
    mode: entry.mode,
    ...(entry.error ? { error: entry.error } : {}),
    ...(entry.spoolerJobId ? { spoolerJobId: entry.spoolerJobId } : {}),
  };

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.appendFile(HISTORY_FILE, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

/**
 * Devuelve las ultimas impresiones, de la mas reciente a la mas antigua.
 *
 * Se lee el archivo entero y se corta por el final porque `print-history.jsonl` es
 * append-only: las lineas nuevas siempre estan al final. Es simple y para el volumen de
 * un puesto de trabajo (unas decenas por dia) es mas barato que un indice invertido.
 */
export async function readPrintHistory(limit = 100): Promise<PrintRecord[]> {
  let raw: string;
  try {
    raw = await fs.readFile(HISTORY_FILE, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  const records: PrintRecord[] = [];
  const lines = raw.split("\n");
  for (let i = lines.length - 1; i >= 0 && records.length < limit; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      records.push(JSON.parse(line) as PrintRecord);
    } catch {
      // Una linea corrupta (por ejemplo, si se corto la escritura a media impresion)
      // no debe tumbar el historial entero.
    }
  }
  return records;
}
