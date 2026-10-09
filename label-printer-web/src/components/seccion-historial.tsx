"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PrintStatus, type PrintState } from "@/components/print-status";
import { HistoryDetail, formatHistoryTs, type HistoryRecord } from "@/components/history-detail";
import {
  badgeErrorClear,
  badgeOkClear,
  buttonClearSecondary,
  cardClear,
  displayTitle,
  input,
  kpiLabel,
  kpiValue,
  label,
  rowSelectedClear,
  select,
  thClear,
} from "@/components/ui";

type EstadoFiltro = "todos" | "ok" | "error";

const LIMITES = [100, 200, 500] as const;
const POR_PAGINA = 25;

const segBase =
  "inline-flex items-center justify-center rounded-pill border px-3 py-1.5 text-xs font-medium transition duration-150";
const segOn = `${segBase} border-strong bg-strong text-white`;
const segOff = `${segBase} border-edge bg-panel text-strong hover:bg-canvas`;

/**
 * Historial potenciado (F2): la MISMA informacion de siempre —fecha, codigo,
 * producto, cantidad, modo, resultado— sobre la piel ClearCraft, con filtros
 * que filtran de verdad sobre lo cargado, paginacion en cliente y detalle por
 * trabajo con reimpresion y exportacion.
 *
 * Todo sale de `GET /api/history`: nada se inventa, nada se estima. Los KPIs
 * se cuentan del set cargado y el caption dice cuantos son.
 *
 * F13: cuerpo de `/history` movido tal cual al tab Historial del hub (`/`).
 * Adaptacion: de `export default function HistoryPage` a
 * `export function SeccionHistorial` (vive sin `page`; el titulo lo pone la tab
 * del hub). Logica, endpoints y estados intactos. El `<main>` se conserva: el
 * shell espera que cada contenido traiga el suyo y el hub solo monta un tab a
 * la vez.
 */
export function SeccionHistorial() {
  const [records, setRecords] = useState<HistoryRecord[] | null>(null);
  const [state, setState] = useState<PrintState>({ kind: "idle" });

  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<EstadoFiltro>("todos");
  const [limite, setLimite] = useState<number>(200);
  const [pagina, setPagina] = useState(1);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const load = useCallback(async (n: number) => {
    setState({ kind: "busy", message: "Cargando historial..." });
    try {
      const res = await fetch(`/api/history?limit=${n}`);
      const data = (await res.json()) as { records?: HistoryRecord[]; error?: string };
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
    void load(limite);
  }, [load, limite]);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (records ?? []).filter((r) => {
      if (estado === "ok" && !r.ok) return false;
      if (estado === "error" && r.ok) return false;
      if (term === "") return true;
      return (
        r.code.toLowerCase().includes(term) || r.name.toLowerCase().includes(term)
      );
    });
  }, [records, q, estado]);

  // Los KPIs responden "cuanto papel y si algo fallo" sobre lo que se esta
  // mirando. El caption dice de cuantos cargados salen, para no vender el
  // filtro como si fuera el total.
  const trabajos = filtrados.length;
  const totalEtiquetas = filtrados.reduce((n, r) => n + (r.ok ? r.qty : 0), 0);
  const fallos = filtrados.filter((r) => !r.ok).length;

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  const selected = (records ?? []).find((r) => r.jobId === selectedJobId) ?? null;

  function elegirEstado(next: EstadoFiltro) {
    setEstado(next);
    setPagina(1);
  }

  return (
    <main className="flex flex-col gap-5">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={`${displayTitle} text-lg`}>Historial de impresiones</h2>
        <button type="button" onClick={() => load(limite)} className={buttonClearSecondary}>
          Actualizar
        </button>
      </section>

      <PrintStatus state={state} idleText="" />

      {/* Filtros: actuan sobre lo cargado, sin pedir nada al servidor. */}
      <section aria-label="Filtros del historial" className={`${cardClear} flex flex-col gap-3 p-4`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label htmlFor="filtro-texto" className={label}>
              Buscar por codigo o producto
            </label>
            <input
              id="filtro-texto"
              type="search"
              autoComplete="off"
              spellCheck={false}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPagina(1);
              }}
              placeholder="Ej. XPRO o nombre del producto"
              className={`${input} mt-1`}
            />
          </div>
          <div>
            <label htmlFor="filtro-limite" className={label}>
              Cargar
            </label>
            <select
              id="filtro-limite"
              value={limite}
              onChange={(e) => {
                setLimite(Number(e.target.value));
                setPagina(1);
              }}
              className={`${select} mt-1 md:w-32`}
            >
              {LIMITES.map((n) => (
                <option key={n} value={n}>
                  {n} trabajos
                </option>
              ))}
            </select>
          </div>
        </div>
        <div role="group" aria-label="Filtrar por estado" className="flex gap-2">
          <button
            type="button"
            aria-pressed={estado === "todos"}
            onClick={() => elegirEstado("todos")}
            className={estado === "todos" ? segOn : segOff}
          >
            Todos
          </button>
          <button
            type="button"
            aria-pressed={estado === "ok"}
            onClick={() => elegirEstado("ok")}
            className={estado === "ok" ? segOn : segOff}
          >
            Exitos
          </button>
          <button
            type="button"
            aria-pressed={estado === "error"}
            onClick={() => elegirEstado("error")}
            className={estado === "error" ? segOn : segOff}
          >
            Errores
          </button>
        </div>
      </section>

      {records !== null && records.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-edge bg-panel px-6 py-12 text-center shadow-float">
          <svg
            viewBox="0 0 24 24"
            width="32"
            height="32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-muted"
            aria-hidden
          >
            <path
              d="M6 9V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V9M6 18H4.5A1.5 1.5 0 0 1 3 16.5v-5A1.5 1.5 0 0 1 4.5 10h15a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 19.5 18H18"
              strokeLinejoin="round"
            />
            <rect x="6" y="14" width="12" height="7" rx="1" />
          </svg>
          <p className="text-sm font-medium text-strong">
            Todavia no hay impresiones registradas.
          </p>
          <p className="text-xs text-muted">
            La primera etiqueta que salga de la Zebra aparece aca.
          </p>
        </div>
      )}

      {records !== null && records.length > 0 && (
        <>
          {/* Los numeros que responden la pregunta de la pagina. */}
          <section aria-label="Resumen" className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-3">
              <div className={`${cardClear} px-4 py-3`}>
                <p className={kpiLabel}>Trabajos</p>
                <p className={kpiValue}>{trabajos}</p>
              </div>
              <div className={`${cardClear} px-4 py-3`}>
                <p className={kpiLabel}>Etiquetas</p>
                <p className={kpiValue}>{totalEtiquetas}</p>
              </div>
              <div className={`${cardClear} px-4 py-3`}>
                <p className={kpiLabel}>Fallos</p>
                <p className={`${kpiValue} ${fallos > 0 ? "text-error" : "text-success"}`}>
                  {fallos}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted">
              Ultimos {records.length} trabajos cargados
              {filtrados.length !== records.length &&
                ` · ${filtrados.length} coinciden con el filtro`}
            </p>
          </section>

          {filtrados.length === 0 ? (
            <div className={`${cardClear} px-6 py-10 text-center`}>
              <p className="text-sm font-medium text-strong">
                Ningun trabajo coincide con el filtro.
              </p>
              <p className="mt-1 text-xs text-muted">
                Afloja el texto o vuelve a Todos para ver los {records.length} cargados.
              </p>
            </div>
          ) : (
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="flex flex-col gap-2">
                <div
                  className={`overflow-x-auto rounded-card border border-edge bg-panel shadow-float`}
                >
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-edge bg-canvas text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className={thClear}>Fecha</th>
                        <th className={thClear}>Codigo</th>
                        <th className={thClear}>Producto</th>
                        <th className={`${thClear} text-right`}>Cant.</th>
                        <th className={thClear}>Modo</th>
                        <th className={thClear}>Resultado</th>
                        <th className={thClear}>
                          <span className="sr-only">Detalle</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-edge">
                      {visibles.map((r) => {
                        const active = r.jobId === selectedJobId;
                        return (
                          <tr
                            key={r.jobId}
                            onClick={() => setSelectedJobId(r.jobId)}
                            className={`cursor-pointer hover:bg-canvas ${active ? rowSelectedClear : ""}`}
                          >
                            <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted">
                              {formatHistoryTs(r.ts)}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs text-strong">{r.code}</td>
                            <td className="px-3 py-2 text-strong">{r.name}</td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums text-strong">
                              {r.qty}
                            </td>
                            <td className="px-3 py-2 text-muted">{r.mode}</td>
                            <td className="px-3 py-2 text-xs">
                              <span className={r.ok ? badgeOkClear : badgeErrorClear}>
                                {r.ok ? "Exito" : (r.error ?? "Error")}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedJobId(r.jobId);
                                }}
                                aria-pressed={active}
                                className={buttonClearSecondary + " px-3 py-1.5 text-xs"}
                              >
                                Ver
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted">
                    Mostrando {(paginaActual - 1) * POR_PAGINA + 1}–
                    {Math.min(paginaActual * POR_PAGINA, filtrados.length)} de {filtrados.length}
                  </p>
                  {totalPaginas > 1 && (
                    <nav aria-label="Paginacion del historial" className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={paginaActual <= 1}
                        onClick={() => setPagina(paginaActual - 1)}
                        className={buttonClearSecondary + " px-3 py-1.5 text-xs"}
                      >
                        Anterior
                      </button>
                      <span className="text-xs tabular-nums text-muted">
                        Pagina {paginaActual} de {totalPaginas}
                      </span>
                      <button
                        type="button"
                        disabled={paginaActual >= totalPaginas}
                        onClick={() => setPagina(paginaActual + 1)}
                        className={buttonClearSecondary + " px-3 py-1.5 text-xs"}
                      >
                        Siguiente
                      </button>
                    </nav>
                  )}
                </div>
              </div>

              {selected ? (
                <div className="xl:sticky xl:top-4">
                  <HistoryDetail
                    key={selected.jobId}
                    record={selected}
                    records={records}
                    onReprinted={() => load(limite)}
                  />
                </div>
              ) : (
                <div className={`${cardClear} px-6 py-10 text-center`}>
                  <p className="text-sm font-medium text-strong">
                    Elige un trabajo de la tabla
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Aca ves el detalle, la vista previa y los botones de reimprimir y exportar.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
