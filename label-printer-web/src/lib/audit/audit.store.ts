import "server-only";
import path from "node:path";
import { createPrintHistory, type NewPrintRecord, type PrintRecord } from "./audit.file";

export type { PrintMode, PrintRecord, PrintStatus } from "./audit.file";

const HISTORY_FILE = path.join(path.resolve(process.cwd(), "data"), "print-history.jsonl");
const history = createPrintHistory(HISTORY_FILE);

/** Agrega una linea al historial. Ver audit.file.ts. */
export function appendPrintRecord(entry: NewPrintRecord): Promise<PrintRecord> {
  return history.append(entry);
}

/** Las ultimas impresiones, de la mas reciente a la mas antigua. */
export function readPrintHistory(limit = 100): Promise<PrintRecord[]> {
  return history.read(limit);
}
