import { spawn } from "node:child_process";
import { NextResponse } from "next/server";

interface ColaConTrabajos {
  nombre: string;
  trabajos: number;
}

/**
 * Trabajos EN COLA por impresora, leidos de Windows de verdad.
 *
 * UN solo `spawn`: `Get-Printer` ya trae `Name` y `JobCount` juntos, asi que la
 * lista de colas y el conteo salen de la misma llamada (antes eran dos
 * `powershell.exe` de ~2 s cada uno). De ahi salen tanto `printers` (nombres,
 * para el desplegable de /settings) como `colas` (nombre + trabajos, para la
 * pill de /).
 *
 * Cache de 3 s en memoria (el mismo TTL de `queue.status.ts`): el refresh
 * post-print de / cae dentro de la ventana y no cuesta otro spawn.
 *
 * Si la consulta falla, se devuelve `null` y la ruta responde SIN `colas` y con
 * `printers: []`: la pill muestra estado sin conteo, con caption honesto, en vez
 * de un 0 que mentiria; /settings sigue permitiendo escribir la cola a mano.
 */
const CACHE_TTL_MS = 3000;
let cache: { at: number; printers: string[]; colas: ColaConTrabajos[] } | null = null;

function leerColas(): Promise<{ printers: string[]; colas: ColaConTrabajos[] } | null> {
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
    const finish = (r: { printers: string[]; colas: ColaConTrabajos[] } | null) => {
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
        const printers: string[] = [];
        const colas: ColaConTrabajos[] = [];
        for (const q of list) {
          if (typeof q.Name !== "string") continue;
          printers.push(q.Name);
          const n =
            typeof q.JobCount === "number" && Number.isFinite(q.JobCount)
              ? Math.max(0, Math.floor(q.JobCount))
              : 0;
          colas.push({ nombre: q.Name, trabajos: n });
        }
        finish({ printers, colas });
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
  const ahora = Date.now();
  if (cache && ahora - cache.at < CACHE_TTL_MS) {
    return NextResponse.json({ printers: cache.printers, colas: cache.colas });
  }
  const leido = await leerColas();
  if (!leido) {
    return NextResponse.json({
      printers: [],
      error: "no se pudo leer la lista de impresoras",
    });
  }
  cache = { at: Date.now(), printers: leido.printers, colas: leido.colas };
  return NextResponse.json({ printers: leido.printers, colas: leido.colas });
}
