"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PrintStatus, type PrintState } from "@/components/print-status";
import {
  badgeErrorClear,
  badgeLoteCancClear,
  badgeLoteCursoClear,
  badgeLoteEsperaClear,
  badgeLoteFinClear,
  badgeLotePausaClear,
  badgeLotePendClear,
  badgeOkClear,
  buttonClear,
  buttonClearSecondary,
  cardClear,
  displayTitle,
  thClear,
} from "@/components/ui";

export interface LoteRow {
  n: number;
  rawCode: string;
  code: string;
  qty: number;
  status: "pendiente" | "ok" | "error";
  error?: string;
}

export interface LoteDetalle {
  id: string;
  name: string;
  filename: string;
  templateId?: string;
  mapping: { code: number; qty: number | null };
  rows: LoteRow[];
  status: "en-espera" | "en-curso" | "pausado" | "finalizado" | "cancelado";
  done: number;
  errors: number;
  createdAt: string;
  updatedAt: string;
  progreso: { total: number; hechas: number; errores: number; pendientes: number };
}

const ESTADO_TEXTO: Record<LoteDetalle["status"], string> = {
  "en-espera": "En espera",
  "en-curso": "En curso",
  pausado: "Pausado",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

const ESTADO_BADGE: Record<LoteDetalle["status"], string> = {
  "en-espera": badgeLoteEsperaClear,
  "en-curso": badgeLoteCursoClear,
  pausado: badgeLotePausaClear,
  finalizado: badgeLoteFinClear,
  cancelado: badgeLoteCancClear,
};

/**
 * Detalle de un lote (F5): progreso real con sondeo, tabla por fila con errores
 * verbatim, y botones segun estado.
 *
 * El sondeo es cada 2 s SOLO mientras el lote esta `en-curso` (es cuando los
 * numeros se mueven); en cualquier otro estado el detalle es estatico y se
 * actualiza al actuar. Sin telemetria: los numeros son filas contadas del lote.
 */
export function LoteDetail({ id, onCambio }: { id: string; onCambio?: () => void }) {
  const [lote, setLote] = useState<LoteDetalle | null>(null);
  const [state, setState] = useState<PrintState>({ kind: "idle" });
  const [actuando, setActuando] = useState<string | null>(null);
  const loteRef = useRef<LoteDetalle | null>(null);
  loteRef.current = lote;

  const cargar = useCallback(async (conAviso: boolean) => {
    if (conAviso) setState({ kind: "busy", message: "Cargando lote..." });
    try {
      const res = await fetch(`/api/lotes/${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = (await res.json()) as LoteDetalle & { error?: string };
      if (!res.ok) {
        if (conAviso) setState({ kind: "error", message: data.error ?? `Error ${res.status}` });
        return;
      }
      setLote(data);
      if (conAviso) setState({ kind: "idle" });
    } catch (err) {
      if (conAviso) setState({ kind: "error", message: (err as Error).message });
    }
  }, [id]);

  useEffect(() => {
    void cargar(true);
  }, [cargar]);

  // Sondeo mientras hay ejecucion viva: es el unico momento en que el progreso cambia.
  useEffect(() => {
    if (lote?.status !== "en-curso") return;
    const t = setInterval(() => {
      void cargar(false);
    }, 2000);
    return () => clearInterval(t);
  }, [lote?.status, cargar]);

  async function actuar(action: string, confirma?: string) {
    if (actuando) return;
    if (confirma && !window.confirm(confirma)) return;
    setActuando(action);
    setState({ kind: "busy", message: "Procesando..." });
    try {
      const res = await fetch(`/api/lotes/${encodeURIComponent(id)}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as { lote?: LoteDetalle; error?: string };
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? `Error ${res.status}` });
        return;
      }
      if (data.lote) {
        // El detalle trae el estado final (la llamada de start/resume/retry ES la
        // ejecucion); igual se recarga para no mostrar un eco de la accion.
        const det = await fetch(`/api/lotes/${encodeURIComponent(id)}`, { cache: "no-store" });
        const fresco = (await det.json()) as LoteDetalle;
        setLote(det.ok ? fresco : data.lote);
      }
      setState({ kind: "idle" });
      onCambio?.();
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message });
    } finally {
      setActuando(null);
    }
  }

  if (!lote && state.kind === "busy") {
    return (
      <section className={`${cardClear} p-4`}>
        <PrintStatus state={state} idleText="" />
      </section>
    );
  }

  if (!lote) {
    return (
      <section className={`${cardClear} p-4`}>
        <PrintStatus state={state} idleText="El lote no se pudo cargar." />
      </section>
    );
  }

  const total = lote.progreso.total;
  const pctHechas = total > 0 ? Math.round((lote.progreso.hechas / total) * 100) : 0;
  const pctErrores = total > 0 ? Math.round((lote.progreso.errores / total) * 100) : 0;

  const ocupado = actuando !== null || lote.status === "en-curso";

  return (
    <section aria-label={`Detalle del lote ${lote.name}`} className="flex flex-col gap-4">
      <div className={`${cardClear} flex flex-col gap-3 p-4`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className={`${displayTitle} text-base`}>{lote.name}</h3>
            <p className="mt-0.5 font-mono text-xs text-muted">{lote.filename}</p>
          </div>
          <span className={ESTADO_BADGE[lote.status]}>{ESTADO_TEXTO[lote.status]}</span>
        </div>

        {/* Progreso contado de las filas: hechas + errores + pendientes = total. */}
        <div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={lote.progreso.hechas}
            aria-label={`Progreso: ${lote.progreso.hechas} de ${total} filas impresas, ${lote.progreso.errores} con error`}
            className="flex h-2.5 w-full overflow-hidden rounded-full bg-canvas"
          >
            <span className="h-full bg-success" style={{ width: `${pctHechas}%` }} />
            <span className="h-full bg-error" style={{ width: `${pctErrores}%` }} />
          </div>
          <p className="mt-1.5 text-xs tabular-nums text-muted">
            {lote.progreso.hechas} de {total} impresas
            {lote.progreso.errores > 0 && ` · ${lote.progreso.errores} con error`}
            {lote.progreso.pendientes > 0 && ` · ${lote.progreso.pendientes} pendientes`}
          </p>
        </div>

        <PrintStatus state={state} idleText="" />

        {/* Botones segun estado. Los que imprimen (start/resume/retry) piden
            confirmacion: inician papel de verdad por la impresora real. */}
        <div className="flex flex-wrap gap-2">
          {lote.status === "en-espera" && (
            <>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => actuar("start", `Iniciar "${lote.name}"? Imprime ${lote.progreso.pendientes} fila(s) de verdad en la impresora.`)}
                className={buttonClear}
              >
                {actuando === "start" ? "Imprimiendo..." : "Iniciar"}
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => actuar("cancel", `Cancelar "${lote.name}"? Las filas pendientes no se imprimen.`)}
                className={buttonClearSecondary}
              >
                Cancelar
              </button>
            </>
          )}
          {lote.status === "en-curso" && (
            <>
              <button
                type="button"
                disabled={actuando !== null}
                onClick={() => actuar("pause")}
                className={buttonClearSecondary}
              >
                Pausar
              </button>
              <button
                type="button"
                disabled={actuando !== null}
                onClick={() => actuar("cancel", `Cancelar "${lote.name}"? Se frena entre etiquetas; lo ya impreso queda impreso.`)}
                className={buttonClearSecondary}
              >
                Cancelar
              </button>
            </>
          )}
          {lote.status === "pausado" && (
            <>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => actuar("resume", `Retomar "${lote.name}"? Sigue imprimiendo donde quedo.`)}
                className={buttonClear}
              >
                {actuando === "resume" ? "Imprimiendo..." : "Retomar"}
              </button>
              {lote.errors > 0 && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => actuar("retry-failed", `Reintentar las ${lote.errors} fila(s) con error de "${lote.name}"?`)}
                  className={buttonClearSecondary}
                >
                  Reintentar errores
                </button>
              )}
              <button
                type="button"
                disabled={ocupado}
                onClick={() => actuar("cancel", `Cancelar "${lote.name}"? Las filas pendientes no se imprimen.`)}
                className={buttonClearSecondary}
              >
                Cancelar
              </button>
            </>
          )}
          {(lote.status === "finalizado" || lote.status === "cancelado") && lote.errors > 0 && (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => actuar("retry-failed", `Reintentar las ${lote.errors} fila(s) con error de "${lote.name}"?`)}
              className={buttonClear}
            >
              {actuando === "retry-failed" ? "Imprimiendo..." : "Reintentar errores"}
            </button>
          )}
        </div>
      </div>

      {/* Tabla por fila: el error va verbatim, es el diagnostico del operador. */}
      <div className={`${cardClear} overflow-x-auto`}>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-edge bg-canvas text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className={thClear}>Fila</th>
              <th className={thClear}>Codigo</th>
              <th className={`${thClear} text-right`}>Cant.</th>
              <th className={thClear}>Estado</th>
              <th className={thClear}>Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {lote.rows.map((r) => (
              <tr key={r.n} className="hover:bg-canvas">
                <td className="px-3 py-2 tabular-nums text-muted">{r.n}</td>
                <td className="px-3 py-2 font-mono text-xs text-strong" title={r.rawCode !== r.code ? `En el CSV: ${r.rawCode}` : undefined}>
                  {r.code === "" ? <span className="text-muted">(sin codigo)</span> : r.code}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-strong">{r.qty}</td>
                <td className="px-3 py-2 text-xs">
                  {r.status === "ok" && <span className={badgeOkClear}>Impresa</span>}
                  {r.status === "error" && <span className={badgeErrorClear}>Error</span>}
                  {r.status === "pendiente" && <span className={badgeLotePendClear}>Pendiente</span>}
                </td>
                <td className="max-w-64 px-3 py-2 text-xs text-muted">{r.error ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
