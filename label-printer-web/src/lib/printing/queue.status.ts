import "server-only";
import { spawn } from "node:child_process";
import path from "node:path";
import { interpretQueueStatus } from "./queue.status.flags";
import { createStatusCache } from "./queue.status.cache";
import type { QueueState, QueueStatus } from "./queue.status.types";

export type { QueueState, QueueStatus };
export { FLAGS, interpretQueueStatus } from "./queue.status.flags";

const SCRIPT = path.resolve(process.cwd(), "scripts", "send-raw.ps1");
const STATUS_TIMEOUT_MS = 12000;

/**
 * Ventana de cache.
 *
 * Medido en este PC: consultar el estado cuesta **~2,3 s**, porque implica lanzar un
 * `powershell.exe` y cargar el modulo PrintManagement. Una ruta pura de la app tarda 69 ms.
 *
 * Por eso el estado **no se puede consultar en cada escaneo**: en modo rapido eso limitaria
 * el ritmo a una etiqueta cada dos segundos. Se cachea y se refresca en segundo plano.
 */
const CACHE_TTL_MS = 3000;

interface RawStatus {
  queue: string;
  found: boolean;
  statusFlags: number | null;
  statusText: string | null;
  jobCount: number;
  port: string | null;
  driver: string | null;
}

function runStatus(printerName: string): Promise<{ raw: RawStatus | null; error: string | null }> {
  return new Promise((resolve) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        SCRIPT,
        "-Printer",
        printerName,
        "-Mode",
        "Status",
      ],
      { windowsHide: true },
    );

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (result: { raw: RawStatus | null; error: string | null }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill();
      finish({ raw: null, error: `timeout leyendo el estado (${STATUS_TIMEOUT_MS}ms)` });
    }, STATUS_TIMEOUT_MS);

    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });

    child.on("error", (err) => finish({ raw: null, error: err.message }));

    child.on("close", () => {
      const line = stdout.trim().split(/\r?\n/).filter(Boolean).pop();
      if (!line) {
        finish({ raw: null, error: stderr.trim() || "el helper no devolvio respuesta" });
        return;
      }
      try {
        const parsed = JSON.parse(line) as RawStatus & { ok: boolean; error: string | null };
        if (!parsed.ok) {
          finish({ raw: null, error: parsed.error ?? "el helper fallo" });
          return;
        }
        finish({ raw: parsed, error: null });
      } catch {
        finish({ raw: null, error: `respuesta ilegible: ${line.slice(0, 200)}` });
      }
    });
  });
}

/** Reads and interprets the status of one queue. Cached and shared by `statusCache`. */
async function fetchQueueStatus(printerName: string): Promise<QueueStatus> {
  const now = Date.now();
  const base: QueueStatus = {
    state: "unknown",
    message: "",
    jobCount: 0,
    checkedAt: new Date(now).toISOString(),
    raw: {
      queue: printerName,
      found: false,
      statusFlags: null,
      statusText: null,
      port: null,
      driver: null,
    },
    error: null,
  };

  const { raw, error } = await runStatus(printerName);

  if (!raw) {
    return { ...base, state: "unknown", message: "No se pudo leer el estado de la impresora", error };
  }

  const rawView: QueueStatus["raw"] = {
    queue: raw.queue,
    found: raw.found,
    statusFlags: raw.statusFlags,
    statusText: raw.statusText,
    port: raw.port,
    driver: raw.driver,
  };

  if (!raw.found) {
    return {
      ...base,
      state: "missing",
      message: `No existe ninguna cola de impresora llamada "${raw.queue}"`,
      raw: rawView,
    };
  }

  const flags = raw.statusFlags ?? 0;
  const interpreted = interpretQueueStatus(flags, raw.jobCount);
  return { ...base, ...interpreted, jobCount: raw.jobCount, raw: rawView };
}

const statusCache = createStatusCache(fetchQueueStatus, CACHE_TTL_MS);

/**
 * Estado de la cola de Windows, cacheado unos segundos y compartido mientras se lee.
 *
 * `force` salta un resultado ya terminado: lo usa el boton "Actualizar" de `/settings` y la
 * primera peticion tras imprimir. Una lectura en curso se comparte siempre. Ver
 * queue.status.cache.ts.
 */
export function readQueueStatus(
  printerName: string,
  options: { force?: boolean } = {},
): Promise<QueueStatus> {
  return statusCache.get(printerName, options);
}
