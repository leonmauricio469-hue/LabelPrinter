import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { listWindowsPrinters } from "@/lib/printing/usb.transport";

interface ColaConTrabajos {
  nombre: string;
  trabajos: number;
}

/**
 * Trabajos EN COLA por impresora, leidos de Windows de verdad.
 *
 * `Get-Printer` expone `JobCount` por cola (es el mismo numero que usa
 * `send-raw.ps1 -Mode Status` para la cola configurada). Va en su propio
 * `spawn` y no dentro de `listWindowsPrinters()` a proposito: ese helper
 * vive fuera de la superficie de F11 y su contrato (`printers: string[]`)
 * lo usa `/settings` tal cual.
 *
 * Si la consulta falla, se devuelve `null` y la ruta responde SIN `colas`:
 * la pill muestra estado sin conteo, con caption honesto, en vez de un 0
 * que mentiria.
 */
function contarTrabajos(): Promise<ColaConTrabajos[] | null> {
  return new Promise((resolve) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "Get-Printer | Select-Object Name,JobCount | ConvertTo-Json -Compress",
      ],
      { windowsHide: true },
    );

    let stdout = "";
    let settled = false;
    const finish = (r: ColaConTrabajos[] | null) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };

    const timer = setTimeout(() => {
      child.kill();
      finish(null);
    }, 10000);

    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.on("error", () => {
      clearTimeout(timer);
      finish(null);
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        const parsed: unknown = JSON.parse(stdout.trim() || "[]");
        // PowerShell 5.1 devuelve un objeto suelto cuando hay una sola cola.
        const list = (Array.isArray(parsed) ? parsed : [parsed]) as Array<{
          Name?: unknown;
          JobCount?: unknown;
        }>;
        const colas: ColaConTrabajos[] = [];
        for (const q of list) {
          if (typeof q.Name !== "string") continue;
          const n =
            typeof q.JobCount === "number" && Number.isFinite(q.JobCount)
              ? Math.max(0, Math.floor(q.JobCount))
              : 0;
          colas.push({ nombre: q.Name, trabajos: n });
        }
        finish(colas);
      } catch {
        finish(null);
      }
    });
  });
}

/**
 * `GET /api/printers` — colas de impresora instaladas en este PC.
 *
 * Solo tiene sentido con `transport: "usb"`. Si la lista falla se responde 200 con
 * `printers: []` y el motivo en `error`: /settings debe poder seguir funcionando
 * escribiendo el nombre de la cola a mano.
 *
 * F11: ademas trae `colas` (nombre + trabajos EN COLA reales) cuando Windows
 * los pudo leer. Sin `colas`, la pill de `/` muestra estado sin conteo.
 */
export async function GET() {
  const { printers, error } = await listWindowsPrinters();
  const colas = await contarTrabajos();
  return NextResponse.json({
    printers,
    ...(colas ? { colas } : {}),
    ...(error && !colas
      ? { error: `${error} (y tampoco se pudo leer el conteo de trabajos)` }
      : error
        ? { error }
        : {}),
  });
}
