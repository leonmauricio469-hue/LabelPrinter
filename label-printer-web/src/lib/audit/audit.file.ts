import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type PrintMode = "normal" | "fast";

/**
 * Lo que se sabe de un envio (E07, E22): la impresora o la cola lo recibio, seguro que no
 * salio, o pudo haber salido. "Impreso" no es un estado: la app no ve el papel.
 */
export type PrintStatus = "enviado" | "fallido" | "incierto";

/**
 * Una linea de `print-history.jsonl`.
 *
 * Version 2 (M01) guarda una foto de lo que se mando: precio, barcode emitido, avisos y
 * medida de etiqueta. Antes solo habia codigo, nombre, cantidad y un booleano, y si el
 * catalogo cambiaba no se podia saber que precio o que codigo salio en una etiqueta vieja.
 * Tres identificadores separados: `jobId` (esta auditoria), `requestId` (la solicitud del
 * cliente, E22) y `spoolerJobId` (el trabajo en la cola de Windows, E10).
 *
 * Las lineas version 1 se siguen leyendo; su `status` se deduce de `ok`.
 */
export interface PrintRecord {
  version: 1 | 2;
  /** ISO-8601, generado al escribir */
  ts: string;
  jobId: string;
  code: string;
  name: string;
  qty: number;
  status: PrintStatus;
  /** `status === "enviado"`. Se mantiene para las lineas y pantallas anteriores. */
  ok: boolean;
  mode: PrintMode;
  /** motivo del fallo cuando no se envio */
  error?: string;
  requestId?: string;
  spoolerJobId?: number;
  /** Precio impreso, tal como estaba en el catalogo en ese momento. */
  price?: number;
  /** Lo que se emitio en `^FD`, o `null` si la etiqueta salio sin codigo. */
  barcode?: { symbology: string; data: string } | null;
  avisos?: string[];
  /** Medida de etiqueta usada (la plantilla sale de ella, ver `buildLabelTemplate`). */
  label?: { widthMm: number; heightMm: number };
}

export type NewPrintRecord = Omit<PrintRecord, "version" | "ts" | "jobId" | "ok"> & { jobId?: string };

function normalizeRecord(raw: Partial<PrintRecord>): PrintRecord {
  const status: PrintStatus = raw.status ?? (raw.ok ? "enviado" : "fallido");
  return { ...raw, version: raw.version ?? 1, status, ok: status === "enviado" } as PrintRecord;
}

/**
 * Historial de impresiones en JSON Lines, append-only.
 *
 * Una impresion por linea: se puede leer con `Get-Content` o con `jq`. Se escribe en modo
 * `append` para no perder lineas si dos impresiones caen a la vez desde pestanas distintas.
 */
export function createPrintHistory(file: string) {
  return {
    async append(entry: NewPrintRecord): Promise<PrintRecord> {
      const record: PrintRecord = {
        version: 2,
        ts: new Date().toISOString(),
        jobId: entry.jobId ?? randomUUID(),
        code: entry.code,
        name: entry.name,
        qty: entry.qty,
        status: entry.status,
        ok: entry.status === "enviado",
        mode: entry.mode,
        ...(entry.error ? { error: entry.error } : {}),
        ...(entry.requestId ? { requestId: entry.requestId } : {}),
        ...(entry.spoolerJobId ? { spoolerJobId: entry.spoolerJobId } : {}),
        ...(entry.price !== undefined ? { price: entry.price } : {}),
        ...(entry.barcode !== undefined ? { barcode: entry.barcode } : {}),
        ...(entry.avisos?.length ? { avisos: entry.avisos } : {}),
        ...(entry.label ? { label: entry.label } : {}),
      };
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.appendFile(file, `${JSON.stringify(record)}\n`, "utf8");
      return record;
    },

    /**
     * Las ultimas impresiones, de la mas reciente a la mas antigua. Se lee el archivo
     * entero: para unas decenas de impresiones por dia es mas barato que un indice.
     */
    async read(limit = 100): Promise<PrintRecord[]> {
      let raw: string;
      try {
        raw = await fs.readFile(file, "utf8");
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
          records.push(normalizeRecord(JSON.parse(line) as Partial<PrintRecord>));
        } catch {
          // Una linea corrupta (una escritura cortada) no debe tumbar el historial entero.
        }
      }
      return records;
    },
  };
}
