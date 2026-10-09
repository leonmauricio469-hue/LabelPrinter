import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
// Import RELATIVO a proposito, igual que en `templates.store.ts`: si este archivo
// entrara algun dia en `tsconfig.preview.json`, ese tsconfig no tiene el alias `@/*`.
import { stripBom } from "../data/json-file";

/**
 * Lotes con CSV (F5): cola de a un lote por vez, persistida en `data/lotes.json`.
 *
 * El archivo lo crea y lo escribe SOLO este store, nunca a mano (igual que
 * `plantillas.json`): si se borra, la lista queda vacia sin dejar rastro.
 *
 * Estados, y por que son cinco:
 *
 * - `en-espera`  -> creado desde un CSV, sin tocar la impresora todavia.
 * - `en-curso`   -> una llamada de control lo esta ejecutando fila por fila.
 * - `pausado`    -> el operador lo freno ENTRE etiquetas, o el servidor se reinicio
 *                    a mitad (`en-curso` huerfano: la llamada que imprimia ya no
 *                    existe, asi que no puede seguir `en-curso`). Siempre retomable.
 * - `finalizado` -> la cola se agoto. Puede traer filas con error: "termino" no es
 *                    "salio todo bien", y `errors` lo dice sin adornos.
 * - `cancelado`   -> el operador lo aborto. Las filas ya impresas quedan `ok` (el
 *                    papel ya salio) y las pendientes se quedan pendientes.
 *
 * No hay "Priorizar" ni cola multi-lote: UN lote activo por vez. Un `start` con otro
 * lote en curso es 409 honesto, no una cola silenciosa que el operador no pidio.
 */

export type LoteRowStatus = "pendiente" | "ok" | "error";

export type LoteStatus = "en-espera" | "en-curso" | "pausado" | "finalizado" | "cancelado";

export interface LoteRow {
  /** Numero de fila de datos del CSV (1-based, sin contar el encabezado). */
  n: number;
  /** Lo que traia la celda del CSV, tal cual (sin recortar mas que espacios). */
  rawCode: string;
  /** Codigo del catalogo cuando se resolvio; el crudo cuando no. */
  code: string;
  qty: number;
  status: LoteRowStatus;
  /** Motivo verbatim cuando `status` es `error`. */
  error?: string;
}

export interface LoteMapping {
  /** Indice de la columna con el codigo. */
  code: number;
  /** Indice de la columna con la cantidad, o `null` = sin columna (valio 1). */
  qty: number | null;
}

export interface Lote {
  id: string;
  name: string;
  filename: string;
  /** Plantilla de la biblioteca, o ausente = la activa al imprimir. */
  templateId?: string;
  mapping: LoteMapping;
  rows: LoteRow[];
  status: LoteStatus;
  /** Filas impresas. */
  done: number;
  /** Filas con error. */
  errors: number;
  createdAt: string;
  updatedAt: string;
}

const loteRowSchema = z.object({
  n: z.number().int().min(1),
  rawCode: z.string().max(120),
  code: z.string().max(120),
  qty: z.number().int().min(1),
  status: z.enum(["pendiente", "ok", "error"]),
  error: z.string().max(2000).optional(),
});

const loteSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  filename: z.string().min(1).max(160),
  templateId: z.string().min(1).max(64).optional(),
  mapping: z.object({
    code: z.number().int().min(0),
    qty: z.number().int().min(0).nullable(),
  }),
  rows: z.array(loteRowSchema),
  status: z.enum(["en-espera", "en-curso", "pausado", "finalizado", "cancelado"]),
  done: z.number().int().min(0),
  errors: z.number().int().min(0),
  createdAt: z.string().min(1).max(64),
  updatedAt: z.string().min(1).max(64),
});

const storeFileSchema = z.object({
  version: z.literal(1),
  lotes: z.array(loteSchema),
});

const DATA_DIR = path.resolve(process.cwd(), "data");
const LOTES_FILE = path.join(DATA_DIR, "lotes.json");

/**
 * Cache por fecha de modificacion, igual que el catalogo y la biblioteca: solo se
 * relee cuando alguien toco el archivo, que es justo cuando hace falta. La ejecucion
 * del lote relee entre filas (para ver pausa/cancelacion), asi que este cache es lo
 * que hace que ese sondeo no sea una revalidacion completa cada vez.
 */
let cache: { mtimeMs: number; value: Lote[] } | null = null;

async function readAll(): Promise<Lote[]> {
  let mtimeMs: number;
  let raw: string;
  try {
    mtimeMs = (await fs.stat(LOTES_FILE)).mtimeMs;
    if (cache && cache.mtimeMs === mtimeMs) return cache.value;
    raw = await fs.readFile(LOTES_FILE, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripBom(raw));
  } catch {
    console.warn("lotes.json ignorado: no es JSON valido. Se sigue con la lista vacia.");
    cache = { mtimeMs, value: [] };
    return [];
  }

  const checked = storeFileSchema.safeParse(parsed);
  if (!checked.success) {
    console.warn(
      "lotes.json ignorado: no tiene la forma { version: 1, lotes: [...] }. " +
        "Se sigue con la lista vacia.",
    );
    cache = { mtimeMs, value: [] };
    return [];
  }

  cache = { mtimeMs, value: checked.data.lotes };
  return checked.data.lotes;
}

/**
 * Escribe la lista entera, a un temporal y luego renombra. El rename en el mismo
 * volumen es atomico en Windows y en Linux, asi que un fallo a medio escribir no
 * deja un `lotes.json` con la mitad del JSON. Mismo patron que `templates.store`.
 */
async function writeAll(lotes: Lote[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${LOTES_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ version: 1, lotes }, null, 2), "utf8");
  await fs.rename(tmp, LOTES_FILE);
  // Se invalida a mano porque el mtime puede coincidir con el anterior dentro del mismo
  // tick en un disco con poca resolucion de reloj.
  cache = null;
}

function newId(existing: Lote[]): string {
  let id = `lote-${randomUUID().slice(0, 8)}`;
  while (existing.some((l) => l.id === id)) {
    id = `lote-${randomUUID().slice(0, 8)}`;
  }
  return id;
}

/** Recuenta `done`/`errors` desde las filas: la fuente son las filas, no un contador. */
export function recount(lote: Lote): void {
  lote.done = lote.rows.filter((r) => r.status === "ok").length;
  lote.errors = lote.rows.filter((r) => r.status === "error").length;
}

/** Los mas nuevos primero: es una cola de trabajo, no un archivo. */
export async function listLotes(): Promise<Lote[]> {
  const lotes = await readAll();
  return [...lotes].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getLote(id: string): Promise<Lote | null> {
  const lotes = await readAll();
  return lotes.find((l) => l.id === id) ?? null;
}

export async function createLote(input: {
  name: string;
  filename: string;
  templateId?: string;
  mapping: LoteMapping;
  rows: LoteRow[];
}): Promise<Lote> {
  const lotes = await readAll();
  const ahora = new Date().toISOString();
  const lote: Lote = {
    id: newId(lotes),
    name: input.name,
    filename: input.filename,
    ...(input.templateId ? { templateId: input.templateId } : {}),
    mapping: input.mapping,
    rows: input.rows,
    status: "en-espera",
    done: 0,
    errors: 0,
    createdAt: ahora,
    updatedAt: ahora,
  };
  recount(lote);
  const checked = loteSchema.safeParse(lote);
  if (!checked.success) {
    throw new Error(`El lote nuevo no valida: ${checked.error.issues[0]?.message ?? "forma invalida"}`);
  }
  await writeAll([...lotes, checked.data]);
  return checked.data;
}

/** Guarda el lote tal cual (upsert por id). Lo usa la ruta de control. */
export async function saveLote(lote: Lote): Promise<Lote> {
  const lotes = await readAll();
  const checked = loteSchema.safeParse(lote);
  if (!checked.success) {
    throw new Error(`El lote no valida: ${checked.error.issues[0]?.message ?? "forma invalida"}`);
  }
  const i = lotes.findIndex((l) => l.id === checked.data.id);
  const copia = [...lotes];
  if (i < 0) copia.push(checked.data);
  else copia[i] = checked.data;
  await writeAll(copia);
  return checked.data;
}
