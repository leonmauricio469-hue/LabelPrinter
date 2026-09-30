import net from "node:net";
import type { PrintResult } from "./printer.types";

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Envia el ZPL por el puerto 9100 y responde cuando la impresora lo recibio entero.
 *
 * Antes respondia "ok" al conectar, antes de escribir un solo byte: una conexion cortada a
 * mitad del lote se presentaba como etiqueta impresa. Ahora el exito es el `close` del
 * socket sin error, despues de que la impresora recibio todo y cerro su lado.
 *
 * Si la impresora deja la conexion abierta, el timeout de inactividad la cierra: con todo
 * escrito cuenta como entregado; a mitad del envio, como fallo. "Entregado" no es "impreso":
 * el papel, la cinta o una pausa en la impresora no se pueden saber por este camino.
 */
export async function sendZpl(host: string, port: number, zpl: string): Promise<PrintResult> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: DEFAULT_TIMEOUT_MS });
    // Despues de conectar ya pudieron llegar bytes: un fallo desde ahi es incierto.
    let connected = false;
    let finished = false;
    let settled = false;
    const settle = (result: PrintResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    socket.on("connect", () => {
      connected = true;
      // UTF-8 explicito: es lo que declara el `^CI28` de cada etiqueta, igual que por USB.
      socket.end(zpl, "utf8", () => {
        finished = true;
      });
    });

    socket.on("timeout", () => {
      socket.destroy();
      settle(
        finished
          ? { ok: true }
          : connected
            ? { ok: false, uncertain: true, error: "timeout enviando a la impresora: el lote pudo llegar a medias" }
            : { ok: false, error: "timeout conectando a la impresora" },
      );
    });

    socket.on("error", (err) => {
      settle(connected ? { ok: false, uncertain: true, error: err.message } : { ok: false, error: err.message });
    });

    socket.on("close", (hadError) => {
      settle(
        !hadError && finished
          ? { ok: true }
          : {
              ok: false,
              uncertain: true,
              error: "la impresora cerro la conexion antes de recibir el lote completo",
            },
      );
    });
  });
}

export async function testConnection(
  host: string,
  port: number,
  timeoutMs = 3000,
): Promise<PrintResult> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: timeoutMs });

    socket.on("connect", () => {
      socket.end();
      resolve({ ok: true });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ ok: false, error: "timeout conectando a la impresora" });
    });

    socket.on("error", (err) => {
      resolve({ ok: false, error: err.message });
    });
  });
}