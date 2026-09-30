import path from "node:path";
import type { PrintResult } from "./printer.types";

const SCRIPT = path.resolve(process.cwd(), "scripts", "send-raw.ps1");

export type SpoolerMode = "Send" | "Check";

export interface SpoolerInvocation {
  args: string[];
  /** Written to the child's stdin and then closed. */
  stdin: string;
}

interface SpoolResponse {
  ok: boolean;
  error: string | null;
  bytes?: number;
  jobId?: number;
  /** The helper failed after the job may have been queued (see send-raw.ps1). */
  uncertain?: boolean;
}

/**
 * Turns send-raw.ps1 output into a print result.
 *
 * The helper prints one JSON line. A job counts as delivered only if the spooler accepted
 * every byte that was sent: the helper already loops over partial writes, and this check
 * makes sure a helper that reports fewer bytes is never shown as a success.
 */
export function spoolerResult(stdout: string, stderr: string, expectedBytes: number): PrintResult {
  const line = stdout.trim().split(/\r?\n/).filter(Boolean).pop();
  if (!line) {
    return { ok: false, error: stderr.trim() || "el helper de impresora no devolvio respuesta" };
  }
  let res: SpoolResponse;
  try {
    res = JSON.parse(line) as SpoolResponse;
  } catch {
    return { ok: false, error: `respuesta ilegible: ${line.slice(0, 200)}` };
  }
  if (!res.ok) {
    return {
      ok: false,
      error: res.error ?? "error desconocido del spooler",
      ...(res.uncertain ? { uncertain: true } : {}),
    };
  }
  if (res.bytes !== undefined && res.bytes !== expectedBytes) {
    return {
      ok: false,
      error: `el spooler recibio ${res.bytes} de ${expectedBytes} bytes: la etiqueta no se envio completa`,
    };
  }
  return res.jobId ? { ok: true, spoolerJobId: res.jobId } : { ok: true };
}

/** Base64 of the ZPL bytes sent to the spooler: UTF-8, as the label's `^CI28` declares. */
export function zplPayload(zpl: string): string {
  return Buffer.from(zpl, "utf8").toString("base64");
}

/**
 * Builds the powershell.exe arguments and stdin payload for send-raw.ps1.
 *
 * The payload goes through stdin, never as an argument: CreateProcess caps the whole
 * command line at 32,767 chars, which a batch of ~7 labels already exceeds.
 */
export function buildSpoolerInvocation(
  printerName: string,
  mode: SpoolerMode,
  base64: string,
): SpoolerInvocation {
  return {
    args: [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      SCRIPT,
      "-Printer",
      printerName,
      "-Mode",
      mode,
    ],
    stdin: mode === "Send" ? base64 : "",
  };
}
