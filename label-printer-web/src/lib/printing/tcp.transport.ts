import net from "node:net";
import type { PrintResult } from "./printer.types";

const DEFAULT_TIMEOUT_MS = 5000;

export async function sendZpl(host: string, port: number, zpl: string): Promise<PrintResult> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: DEFAULT_TIMEOUT_MS });

    socket.on("connect", () => {
      socket.write(zpl);
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