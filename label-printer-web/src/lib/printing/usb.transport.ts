import "server-only";
import { spawn } from "node:child_process";
import path from "node:path";
import type { PrintResult } from "./printer.types";

const SCRIPT = path.resolve(process.cwd(), "scripts", "send-raw.ps1");
const DEFAULT_TIMEOUT_MS = 15000;

interface SpoolResponse {
  ok: boolean;
  error: string | null;
  bytes?: number;
  queue?: string;
  port?: string;
}

function runSpooler(
  printerName: string,
  mode: "Send" | "Check",
  base64: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SpoolResponse> {
  return new Promise((resolve) => {
    const args = [
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
    ];
    if (mode === "Send") {
      args.push("-Base64", base64);
    }

    const child = spawn("powershell.exe", args, { windowsHide: true });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      resolve({ ok: false, error: `timeout enviando a la impresora (${timeoutMs}ms)` });
    }, timeoutMs);

    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, error: err.message });
    });

    child.on("close", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      const line = stdout.trim().split(/\r?\n/).filter(Boolean).pop();
      if (!line) {
        resolve({
          ok: false,
          error: stderr.trim() || "el helper de impresora no devolvio respuesta",
        });
        return;
      }
      try {
        resolve(JSON.parse(line) as SpoolResponse);
      } catch {
        resolve({ ok: false, error: `respuesta ilegible: ${line.slice(0, 200)}` });
      }
    });
  });
}

/** Writes raw ZPL bytes to a Windows printer queue (USB). */
export async function sendZplUsb(
  printerName: string,
  zpl: string,
): Promise<PrintResult> {
  const res = await runSpooler(
    printerName,
    "Send",
    Buffer.from(zpl, "latin1").toString("base64"),
  );
  if (!res.ok) {
    return { ok: false, error: res.error ?? "error desconocido del spooler" };
  }
  return { ok: true };
}

/** Checks that the queue exists and can be opened. */
export async function testUsbConnection(
  printerName: string,
): Promise<PrintResult> {
  const res = await runSpooler(printerName, "Check", "", 8000);
  if (!res.ok) {
    return { ok: false, error: res.error ?? "no se pudo abrir la cola" };
  }
  return { ok: true };
}

/**
 * Lista los nombres de cola de impresora de Windows.
 *
 * Existe para que /settings ofrezca un desplegable. Escribir el nombre a mano es una
 * fuente de fallos innecesaria: una cola mal escrita no da ningun aviso en la UI hasta
 * que el spooler devuelve "no se pudo abrir la cola" en el momento de imprimir.
 *
 * Devuelve un objeto y no lanza: si la lista falla, /settings debe poder seguir
 * escribiendo la cola a mano.
 */
export async function listWindowsPrinters(): Promise<{
  printers: string[];
  error: string | null;
}> {
  return new Promise((resolve) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "Get-Printer | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress",
      ],
      { windowsHide: true },
    );

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (result: { printers: string[]; error: string | null }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill();
      finish({ printers: [], error: "timeout listando las impresoras" });
    }, 10000);

    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      finish({ printers: [], error: err.message });
    });

    child.on("close", () => {
      clearTimeout(timer);
      try {
        const parsed: unknown = JSON.parse(stdout.trim() || "[]");
        // PowerShell 5.1 devuelve un objeto suelto, no un arreglo, cuando el
        // resultado es de un solo elemento.
        const list = Array.isArray(parsed) ? parsed : [parsed];
        finish({
          printers: list.filter((x): x is string => typeof x === "string"),
          error: null,
        });
      } catch {
        finish({
          printers: [],
          error: stderr.trim() || "no se pudo leer la lista de impresoras",
        });
      }
    });
  });
}
