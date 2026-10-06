"use client";

import { useCallback, useEffect, useState } from "react";
import { PrintStatus, type PrintState } from "@/components/print-status";
import { buttonGhost, card, h2 } from "@/components/ui";

interface Record_ {
  ts: string;
  jobId: string;
  code: string;
  name: string;
  qty: number;
  ok: boolean;
  mode: string;
  error?: string;
}

function formatTs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function HistoryPage() {
  const [records, setRecords] = useState<Record_[] | null>(null);
  const [state, setState] = useState<PrintState>({ kind: "idle" });

  const load = useCallback(async () => {
    setState({ kind: "busy", message: "Cargando historial..." });
    try {
      const res = await fetch("/api/history?limit=200");
      const data = (await res.json()) as { records?: Record_[]; error?: string };
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? `Error ${res.status}` });
        return;
      }
      setRecords(data.records ?? []);
      setState({ kind: "idle" });
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Resumen de la ultima carga.
   *
   * La pregunta real de esta pagina no es "que se imprimio" sino "cuanto papel llevo hoy
   * y si algo fallo". Contestarla exigiendo leer 200 filas en un monitor de mostrador no
   * es una respuesta. Los dos numeros se calculan una vez por carga, no por render.
   */
  const totalEtiquetas = (records ?? []).reduce((n, r) => n + (r.ok ? r.qty : 0), 0);
  const fallos = (records ?? []).filter((r) => !r.ok).length;

  return (
    <main className="flex flex-col gap-5">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={h2}>Historial de impresiones</h2>
        <button type="button" onClick={load} className={buttonGhost}>
          Actualizar
        </button>
      </section>

      <PrintStatus state={state} idleText="" />

      {records !== null && records.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <svg
            viewBox="0 0 24 24"
            width="32"
            height="32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-line-strong"
            aria-hidden
          >
            <path
              d="M6 9V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V9M6 18H4.5A1.5 1.5 0 0 1 3 16.5v-5A1.5 1.5 0 0 1 4.5 10h15a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 19.5 18H18"
              strokeLinejoin="round"
            />
            <rect x="6" y="14" width="12" height="7" rx="1" />
          </svg>
          <p className="text-sm font-medium text-ink-soft">
            Todavia no hay impresiones registradas.
          </p>
          <p className="text-xs text-ink-mute">
            La primera etiqueta que salga de la Zebra aparece aca.
          </p>
        </div>
      )}

      {records !== null && records.length > 0 && (
        <>
          {/* Los dos numeros que responden la pregunta de la pagina. */}
          <div className="grid grid-cols-2 gap-3">
            <div className={card + " px-4 py-3"}>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-mute">
                Etiquetas
              </p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-ink">
                {totalEtiquetas}
              </p>
            </div>
            <div className={`${card} px-4 py-3 ${fallos > 0 ? "border-danger-line bg-danger-soft" : ""}`}>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-mute">
                Fallos
              </p>
              <p
                className={`mt-0.5 text-2xl font-bold tabular-nums ${
                  fallos > 0 ? "text-danger" : "text-ok"
                }`}
              >
                {fallos}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-sunken text-xs uppercase tracking-wide text-ink-mute">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Fecha</th>
                  <th className="px-3 py-2.5 font-medium">Codigo</th>
                  <th className="px-3 py-2.5 font-medium">Producto</th>
                  <th className="px-3 py-2.5 text-right font-medium">Cant.</th>
                  <th className="px-3 py-2.5 font-medium">Modo</th>
                  <th className="px-3 py-2.5 font-medium">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {records.map((r) => (
                  <tr
                    key={r.jobId}
                    className={
                      r.ok
                        ? "hover:bg-surface-sunken/60"
                        : "bg-danger-soft"
                    }
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-ink-mute">
                      {formatTs(r.ts)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-ink-soft">{r.code}</td>
                    <td className="px-3 py-2 text-ink">{r.name}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink">
                      {r.qty}
                    </td>
                    <td className="px-3 py-2 text-ink-mute">{r.mode}</td>
                    <td className="px-3 py-2 text-xs">
                      <span
                        className={`inline-flex items-center gap-1.5 font-medium ${
                          r.ok ? "text-ok" : "text-danger"
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`size-1.5 rounded-full ${r.ok ? "bg-ok" : "bg-danger"}`}
                        />
                        {r.ok ? "OK" : (r.error ?? "fallo")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
