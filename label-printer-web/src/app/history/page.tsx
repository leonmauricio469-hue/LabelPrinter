"use client";

import { useCallback, useEffect, useState } from "react";
import { PrintStatus, type PrintState } from "@/components/print-status";

// Solo el tipo: `import type` se borra al compilar y no trae `node:fs` al cliente.
import type { PrintRecord as Record_, PrintStatus as SendStatus } from "@/lib/audit/audit.file";

/** "Enviado" y no "OK": la app sabe que la impresora lo recibio, no que salio el papel (E07). */
const STATUS_VIEW: Record<SendStatus, { label: string; className: string; row: string }> = {
  enviado: { label: "Enviado", className: "text-green-700", row: "" },
  fallido: { label: "Fallido", className: "text-red-700", row: "bg-red-50" },
  incierto: { label: "Incierto: revisar la impresora", className: "text-amber-700", row: "bg-amber-50" },
};

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

  return (
    <main className="flex flex-col gap-6">
      <section className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">
          Historial de impresiones
        </h2>
        <button
          type="button"
          onClick={load}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-100"
        >
          Actualizar
        </button>
      </section>

      <PrintStatus state={state} idleText="" />

      {records !== null && records.length === 0 && (
        <p className="rounded-lg border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500 shadow-sm">
          Todavia no hay impresiones registradas.
        </p>
      )}

      {records !== null && records.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Codigo</th>
                <th className="px-3 py-2 font-medium">Producto</th>
                <th className="px-3 py-2 text-right font-medium">Cant.</th>
                <th className="px-3 py-2 text-right font-medium">Precio</th>
                <th className="px-3 py-2 font-medium">Codigo emitido</th>
                <th className="px-3 py-2 font-medium">Modo</th>
                <th className="px-3 py-2 font-medium">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {records.map((r) => (
                <tr key={r.jobId} className={STATUS_VIEW[r.status].row}>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-neutral-600">
                    {formatTs(r.ts)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-neutral-700">{r.code}</td>
                  <td className="px-3 py-2 text-neutral-900">{r.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-900">
                    {r.qty}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-900">
                    {r.price !== undefined ? `$${r.price.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-neutral-700">
                    {r.barcode === undefined ? "—" : r.barcode === null ? "sin codigo" : r.barcode.data}
                  </td>
                  <td className="px-3 py-2 text-neutral-600">{r.mode}</td>
                  <td className={`px-3 py-2 text-xs ${STATUS_VIEW[r.status].className}`}>
                    {STATUS_VIEW[r.status].label}
                    {r.error ? `: ${r.error}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
