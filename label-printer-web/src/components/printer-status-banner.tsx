"use client";

import { useCallback, useEffect, useState } from "react";
import { createPollGate } from "@/lib/printing/poll.gate";
import type { QueueState, QueueStatus } from "@/lib/printing/queue.status.types";

/**
 * Suelo de sondeo, en ms.
 *
 * No es lo unico que dispara la consulta: tambien `refreshKey`. Sondear cada pocos segundos
 * costaria un `powershell.exe` constante, y medido aqui cada uno cuesta ~2,3 s. El estado
 * solo cambia cuando alguien usa la impresora, y lo unico que la usa es esta app, asi que
 * refrescar **despues de cada impresion** cubre el caso real; el sondeo es solo la red de
 * seguridad para cuando el papel se acaba entre dos tiradas.
 */
const POLL_MS = 20000;

const DOT: Record<QueueState, string> = {
  ready: "bg-green-500",
  busy: "bg-blue-500",
  warning: "bg-amber-500",
  blocked: "bg-red-600",
  missing: "bg-red-600",
  unknown: "bg-neutral-400",
};

const TONE: Record<QueueState, string> = {
  ready: "border-neutral-200 bg-white text-neutral-600",
  busy: "border-blue-200 bg-blue-50 text-blue-800",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  blocked: "border-red-300 bg-red-50 text-red-800",
  missing: "border-red-300 bg-red-50 text-red-800",
  unknown: "border-neutral-200 bg-neutral-50 text-neutral-500",
};

const EMPTY: QueueStatus = {
  state: "unknown",
  message: "Consultando...",
  jobCount: 0,
  checkedAt: "",
  raw: {
    queue: "",
    found: false,
    statusFlags: null,
    statusText: null,
    port: null,
    driver: null,
  },
  error: null,
};

/**
 * Convierte lo que vino de la API en un `QueueStatus`, o `null` si no lo es.
 *
 * Hace falta porque el endpoint devuelve 500 con `{ error }` cuando no puede leer la
 * configuracion. Sin esta comprobacion el banner reventaba con
 * "Cannot read properties of undefined (reading 'found')" y se llevaba la pagina entera
 * por delante, que es peor que no mostrar el estado de la impresora.
 */
function asQueueStatus(body: unknown): QueueStatus | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Partial<QueueStatus>;
  if (typeof b.state !== "string" || typeof b.message !== "string") return null;
  if (typeof b.raw !== "object" || b.raw === null) return null;
  return {
    ...EMPTY,
    ...b,
    raw: { ...EMPTY.raw, ...b.raw },
  };
}

function usePrinterStatus(refreshKey: number) {
  const [status, setStatus] = useState<QueueStatus>(EMPTY);
  const [loading, setLoading] = useState(true);

  // Una consulta a la vez (cada una dura ~2,3 s), pero sin perder el refresco que se pide
  // tras imprimir mientras otro sondeo esta en curso. Ver poll.gate.ts.
  const [gate] = useState(() =>
    createPollGate(async (force: boolean) => {
      try {
        const res = await fetch(
          force ? "/api/printer/status?force=1" : "/api/printer/status",
          { cache: "no-store" },
        );
        const parsed = asQueueStatus(await res.json().catch(() => null));
        setStatus(
          parsed ?? {
            ...EMPTY,
            state: "unknown",
            message: "La API no devolvio un estado reconocible",
            error: `HTTP ${res.status}`,
          },
        );
      } catch {
        setStatus({
          ...EMPTY,
          state: "unknown",
          message: "No se pudo consultar el estado de la impresora",
          error: "fallo de red",
        });
      } finally {
        setLoading(false);
      }
    }),
  );
  const poll = useCallback((force: boolean) => gate.request(force), [gate]);

  useEffect(() => {
    void poll(true);
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void poll(false);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [poll]);

  // `refreshKey` cambia despues de cada impresion: para entonces el trabajo ya fue
  // entregado al spooler, asi que la cola muestra el estado bueno y no el viejo.
  useEffect(() => {
    if (refreshKey === 0) return;
    void poll(true);
  }, [refreshKey, poll]);

  return { status, loading, refresh: () => poll(true) };
}

/**
 * Estado real de la impresora, visible.
 *
 * **No bloquea la impresion.** Si la cola esta mal, Windows guarda el trabajo y lo imprime
 * cuando vuelva, y negarse a imprimir seria tirar las etiquetas. Lo que hace es avisar,
 * que es justo lo que faltaba: antes `POST /api/printer/test` respondia `ok` con la
 * impresora apagada, y eso no lo distingue de una impresion correcta.
 *
 * `hideWhenReady` lo usa `/fast`, donde la pantalla es un cartel grande y el estado normal
 * solo estorba.
 */
export function PrinterStatusBanner({
  hideWhenReady = false,
  refreshKey = 0,
  showDetails = false,
}: {
  hideWhenReady?: boolean;
  refreshKey?: number;
  showDetails?: boolean;
}) {
  const { status, loading, refresh } = usePrinterStatus(refreshKey);

  if (hideWhenReady && !loading && status.state === "ready" && status.jobCount === 0) {
    return null;
  }

  const etiqueta = status.state === "blocked" || status.state === "missing" ? "Bloqueada" : "Impresora";
  const cola = status.jobCount > 0 ? ` · ${status.jobCount} en cola` : "";

  return (
    <div className={`rounded-md border px-4 py-2.5 text-sm ${TONE[status.state]}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-2 font-semibold">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${DOT[status.state]}`} />
          {etiqueta}: {status.message || "..."}
          {cola}
        </span>

        {status.raw.found && status.raw.queue && (
          <span className="text-xs opacity-70">
            {status.raw.queue}
            {status.raw.port ? ` · ${status.raw.port}` : ""}
          </span>
        )}

        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="ml-auto rounded border border-current/30 px-2 py-0.5 text-xs font-medium opacity-80 hover:opacity-100 disabled:opacity-40"
        >
          {loading ? "Consultando..." : "Actualizar"}
        </button>
      </div>

      {status.error && (
        <p className="mt-1 text-xs opacity-80">Detalle: {status.error}</p>
      )}

      {showDetails && status.raw.found && (
        <p className="mt-1 font-mono text-[11px] opacity-70">
          flags={status.raw.statusFlags} ({status.raw.statusText}) · driver={status.raw.driver} ·{" "}
          {status.checkedAt ? new Date(status.checkedAt).toLocaleTimeString() : "-"}
        </p>
      )}
    </div>
  );
}
