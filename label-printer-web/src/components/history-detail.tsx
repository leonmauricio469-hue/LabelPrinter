"use client";

import { useEffect, useState } from "react";
import {
  badgeErrorClear,
  badgeOkClear,
  buttonClear,
  buttonClearSecondary,
  cardClear,
  hint,
  input,
  label,
} from "@/components/ui";

/**
 * Campos REALES de `PrintRecord` (`src/lib/audit/audit.store.ts`).
 *
 * Son estos y solo estos: el registro NO guarda el payload ZPL, asi que el
 * detalle no lo muestra ni lo exporta. La vista previa se REGENERA con
 * `GET /api/labels/preview?code=` y el caption lo dice tal cual.
 */
export interface HistoryRecord {
  ts: string;
  jobId: string;
  code: string;
  name: string;
  qty: number;
  ok: boolean;
  mode: string;
  error?: string;
}

/** Fecha del registro en formato corto de mostrador. Si no parsea, el ISO tal cual. */
export function formatHistoryTs(iso: string): string {
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

/**
 * Columnas del CSV: EXACTAMENTE los campos del registro, nada mas.
 * `ok` sale como `true`/`false` (el valor crudo) y `error` vacio si no hubo.
 */
export function buildHistoryCsv(rows: HistoryRecord[]): string {
  const header = ["ts", "jobId", "code", "name", "qty", "ok", "mode", "error"];
  const lines = rows.map((r) =>
    [r.ts, r.jobId, r.code, r.name, String(r.qty), String(r.ok), r.mode, r.error ?? ""]
      .map(csvCell)
      .join(","),
  );
  return `${header.join(",")}\n${lines.join("\n")}${lines.length > 0 ? "\n" : ""}`;
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Detalle de un trabajo del historial.
 *
 * Todo sale del registro y de endpoints reales: los campos son los de
 * `PrintRecord`, la imagen es `GET /api/labels/preview?code=` (regenerada con
 * la plantilla ACTUAL, no la que se uso al imprimir) y Reimprimir es
 * `POST /api/labels` con el mismo codigo. Sin telemetria, sin ACK, sin ZPL
 * guardado en ningun lado.
 */
export function HistoryDetail({
  record,
  records,
  onReprinted,
}: {
  record: HistoryRecord;
  /** Set cargado en la pagina: es lo que exporta el CSV. */
  records: HistoryRecord[];
  /** La pagina recarga el historial tras una reimpresion exitosa. */
  onReprinted: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [desde, setDesde] = useState("1");
  const [hasta, setHasta] = useState(String(record.qty));
  const [reprinting, setReprinting] = useState(false);
  const [reprintMsg, setReprintMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // El padre monta con `key={record.jobId}`, asi que un trabajo distinto es un
  // componente nuevo: no hace falta resetear estado al cambiar de registro.

  useEffect(() => {
    const ctrl = new AbortController();
    let objectUrl: string | null = null;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewUrl(null);

    void (async () => {
      try {
        const res = await fetch(`/api/labels/preview?code=${encodeURIComponent(record.code)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) {
          let mensaje = `La app respondio ${res.status}`;
          try {
            const data = (await res.json()) as { error?: unknown };
            if (typeof data.error === "string" && data.error !== "") mensaje = data.error;
          } catch {
            // El cuerpo no era JSON: se queda el mensaje por defecto con el estado.
          }
          throw new Error(mensaje);
        }
        const blob = await res.blob();
        if (ctrl.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setPreviewError((err as Error).message);
      } finally {
        if (!ctrl.signal.aborted) setPreviewLoading(false);
      }
    })();

    return () => {
      ctrl.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [record.code]);

  // El subrango solo existe si el trabajo traia mas de una etiqueta. Las
  // etiquetas son identicas entre si, asi que reimprimir Desde/Hasta es pedir
  // (hasta - desde + 1) copias del mismo codigo.
  const multi = record.qty > 1;
  const d = Number.parseInt(desde, 10);
  const h = Number.parseInt(hasta, 10);
  const rangoValido =
    !multi ||
    (Number.isInteger(d) && Number.isInteger(h) && d >= 1 && h <= record.qty && d <= h);
  const subQty = multi ? (rangoValido ? h - d + 1 : 0) : record.qty;

  async function reimprimir() {
    if (reprinting || (multi && !rangoValido)) return;
    setReprinting(true);
    setReprintMsg(null);
    try {
      const res = await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productCode: record.code,
          qty: subQty,
          mode: record.mode === "fast" ? "fast" : "normal",
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; qty?: number };
      if (!res.ok || !data.ok) {
        setReprintMsg({ ok: false, text: data.error ?? `La impresion fallo (HTTP ${res.status})` });
        return;
      }
      const n = data.qty ?? subQty;
      setReprintMsg({
        ok: true,
        text: `${n} etiqueta${n === 1 ? "" : "s"} reimpresa${n === 1 ? "" : "s"}`,
      });
      onReprinted();
    } catch (err) {
      setReprintMsg({ ok: false, text: `No se pudo contactar la app: ${(err as Error).message}` });
    } finally {
      setReprinting(false);
    }
  }

  function exportarCsv() {
    // BOM para que Excel abra los tildes sin romperlos. El contenido son solo
    // los campos del registro.
    const blob = new Blob(["\uFEFF" + buildHistoryCsv(records)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historial-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section aria-label="Detalle del trabajo" className={`${cardClear} flex flex-col gap-4 p-5`}>
      <h3 className="font-display text-sm font-bold tracking-tight text-strong">
        Detalle del trabajo
      </h3>

      <dl className="text-sm">
        <div className="flex items-baseline justify-between gap-3 border-b border-edge py-1.5">
          <dt className="shrink-0 text-xs text-muted">Fecha</dt>
          <dd className="font-mono text-xs text-strong">{formatHistoryTs(record.ts)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-b border-edge py-1.5">
          <dt className="shrink-0 text-xs text-muted">Codigo</dt>
          <dd className="font-mono text-xs text-strong">{record.code}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-b border-edge py-1.5">
          <dt className="shrink-0 text-xs text-muted">Producto</dt>
          <dd className="text-right text-strong">{record.name}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-b border-edge py-1.5">
          <dt className="shrink-0 text-xs text-muted">Cantidad</dt>
          <dd className="font-semibold tabular-nums text-strong">{record.qty}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-b border-edge py-1.5">
          <dt className="shrink-0 text-xs text-muted">Modo</dt>
          <dd className="text-strong">{record.mode}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-1.5">
          <dt className="shrink-0 text-xs text-muted">Resultado</dt>
          <dd>
            <span className={record.ok ? badgeOkClear : badgeErrorClear}>
              {record.ok ? "Exito" : "Error"}
            </span>
          </dd>
        </div>
        {record.error && (
          <div className="flex flex-col gap-1 py-1.5">
            <dt className="text-xs text-muted">Error</dt>
            <dd role="alert" className="text-sm leading-relaxed text-error">
              {record.error}
            </dd>
          </div>
        )}
      </dl>

      <figure>
        {previewLoading && (
          <div
            role="status"
            style={{ aspectRatio: "472 / 280" }}
            className="grid w-full animate-pulse place-items-center rounded-field border border-edge bg-canvas"
          >
            <p className="text-sm text-muted">Generando…</p>
          </div>
        )}
        {previewError && (
          <div
            style={{ aspectRatio: "472 / 280" }}
            className="grid w-full place-items-center rounded-field border border-edge bg-canvas p-4"
          >
            <p role="alert" className="text-center text-sm leading-relaxed text-error">
              {previewError}
            </p>
          </div>
        )}
        {previewUrl && (
          <img
            src={previewUrl}
            alt={`Vista previa de la etiqueta del producto ${record.code}`}
            style={{ aspectRatio: "472 / 280" }}
            className="h-auto w-full rounded-field border border-edge bg-white"
          />
        )}
        <figcaption className="mt-1.5 text-xs text-muted">
          Vista previa regenerada con la plantilla actual
        </figcaption>
      </figure>

      <div className="flex flex-col gap-3 rounded-field border border-edge bg-canvas p-4">
        <span className={label}>Reimprimir</span>
        {multi ? (
          <>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label htmlFor={`desde-${record.jobId}`} className={label}>
                  Desde
                </label>
                <input
                  id={`desde-${record.jobId}`}
                  type="number"
                  min={1}
                  max={record.qty}
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  disabled={reprinting}
                  className={`${input} mt-1`}
                />
              </div>
              <div className="flex-1">
                <label htmlFor={`hasta-${record.jobId}`} className={label}>
                  Hasta
                </label>
                <input
                  id={`hasta-${record.jobId}`}
                  type="number"
                  min={1}
                  max={record.qty}
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  disabled={reprinting}
                  className={`${input} mt-1`}
                />
              </div>
            </div>
            <p className={hint}>
              {rangoValido
                ? `Se reimprimen ${subQty} de las ${record.qty} etiquetas.`
                : `El rango tiene que estar entre 1 y ${record.qty}, con Desde menor o igual que Hasta.`}
            </p>
          </>
        ) : (
          <p className={hint}>Se reimprime la misma etiqueta, 1 copia.</p>
        )}
        <button
          type="button"
          onClick={reimprimir}
          disabled={reprinting || (multi && !rangoValido)}
          className={buttonClear}
          aria-busy={reprinting}
        >
          {reprinting ? "Reimprimiendo..." : "Reimprimir"}
        </button>
        {reprintMsg && (
          <p
            role={reprintMsg.ok ? "status" : "alert"}
            className={`text-sm leading-relaxed ${reprintMsg.ok ? "text-success" : "text-error"}`}
          >
            {reprintMsg.text}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <button type="button" onClick={exportarCsv} className={buttonClearSecondary}>
          Exportar CSV
        </button>
        <p className={hint}>
          Descarga los {records.length} trabajos cargados, con las columnas del registro.
        </p>
      </div>
    </section>
  );
}
