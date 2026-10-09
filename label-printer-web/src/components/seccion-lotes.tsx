"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoteDetail } from "@/components/lote-detail";
import { PrintStatus, type PrintState } from "@/components/print-status";
import {
  badgeLoteCancClear,
  badgeLoteCursoClear,
  badgeLoteEsperaClear,
  badgeLoteFinClear,
  badgeLotePausaClear,
  buttonClear,
  buttonClearSecondary,
  cardClear,
  displayTitle,
  hint,
  input,
  label,
  select,
  thClear,
} from "@/components/ui";

interface PreviewRow {
  n: number;
  rawCode: string;
  code: string;
  qty: number;
  name: string | null;
  status: "ok" | "error";
  error?: string;
}

interface PreviewMapeo {
  columns: string[];
  total: number;
  resueltas: number;
  rows: PreviewRow[];
  mapping: { code: number; qty: number | null };
  delimiter: "," | ";";
  hasHeader: boolean;
}

interface LoteResumen {
  id: string;
  name: string;
  filename: string;
  templateId?: string;
  status: "en-espera" | "en-curso" | "pausado" | "finalizado" | "cancelado";
  done: number;
  errors: number;
  total: number;
  createdAt: string;
  updatedAt: string;
}

interface PlantillaOpcion {
  id: string;
  name: string;
  kind: "estructurada" | "raw";
  archived: boolean;
}

const ESTADO_TEXTO: Record<LoteResumen["status"], string> = {
  "en-espera": "En espera",
  "en-curso": "En curso",
  pausado: "Pausado",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

const ESTADO_BADGE: Record<LoteResumen["status"], string> = {
  "en-espera": badgeLoteEsperaClear,
  "en-curso": badgeLoteCursoClear,
  pausado: badgeLotePausaClear,
  finalizado: badgeLoteFinClear,
  cancelado: badgeLoteCancClear,
};

/** Lee el archivo y lo decodifica: UTF-8 estricto, y si falla, Windows-1252 (Excel). */
function decodificar(buf: ArrayBuffer): { texto: string; encoding: string } {
  try {
    return { texto: new TextDecoder("utf-8", { fatal: true }).decode(buf), encoding: "UTF-8" };
  } catch {
    return { texto: new TextDecoder("windows-1252").decode(buf), encoding: "Windows-1252" };
  }
}

/** Miniatura de una fila resuelta: el PNG real del preview, con caption honesto. */
function ThumbFila({ code, templateId }: { code: string; templateId?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    let objectUrl: string | null = null;
    void (async () => {
      try {
        const qs = `/api/labels/preview?code=${encodeURIComponent(code)}${templateId ? `&template=${encodeURIComponent(templateId)}` : ""}`;
        const res = await fetch(qs, { signal: ctrl.signal });
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
        setUrl(objectUrl);
      } catch (err) {
        if (!ctrl.signal.aborted) setError((err as Error).message);
      }
    })();
    return () => {
      ctrl.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [code, templateId]);

  if (error) return <span className="text-xs text-muted">Sin vista: {error}</span>;
  if (!url) return <span className="text-xs text-muted">Cargando vista...</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={`Vista previa de la etiqueta de ${code}`} className="h-14 w-auto rounded border border-edge bg-white" />;
}

/**
 * `/lotes` (F5): CSV → mapeo generico → lote con progreso real.
 *
 * Tres pasos, sin ERP: 1) subir el CSV real (se decodifica en el cliente), 2)
 * mapear columnas a codigo/cantidad con conteo de resueltas y vista de las 5
 * primeras, 3) crear el lote. Debajo, la lista de lotes con su estado y el
 * detalle con botones segun estado. Sin "Priorizar": un lote activo por vez.
 *
 * F13: cuerpo de `/lotes` movido tal cual al tab Lotes del hub (`/`).
 * Adaptacion: de `export default function LotesPage` a
 * `export function SeccionLotes` (vive sin `page`; el titulo lo pone la tab del
 * hub). Logica, endpoints y estados intactos. El `<main>` se conserva: el shell
 * espera que cada contenido traiga el suyo y el hub solo monta un tab a la vez.
 */
export function SeccionLotes() {
  const [archivo, setArchivo] = useState<{ filename: string; content: string; encoding: string } | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [colCodigo, setColCodigo] = useState(0);
  const [colCantidad, setColCantidad] = useState<number | null>(null);
  const [preview, setPreview] = useState<PreviewMapeo | null>(null);
  const [state, setState] = useState<PrintState>({ kind: "idle" });

  const [nombre, setNombre] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [plantillas, setPlantillas] = useState<PlantillaOpcion[] | null>(null);
  const [creando, setCreando] = useState(false);

  const [lotes, setLotes] = useState<LoteResumen[] | null>(null);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const lotesRef = useRef<LoteResumen[] | null>(null);
  lotesRef.current = lotes;

  const cargarLotes = useCallback(async (conAviso: boolean) => {
    if (conAviso) setState({ kind: "busy", message: "Cargando lotes..." });
    try {
      const res = await fetch("/api/lotes", { cache: "no-store" });
      const data = (await res.json()) as { lotes?: LoteResumen[]; error?: string };
      if (!res.ok) {
        if (conAviso) setState({ kind: "error", message: data.error ?? `Error ${res.status}` });
        return;
      }
      setLotes(data.lotes ?? []);
      if (conAviso) setState({ kind: "idle" });
    } catch (err) {
      if (conAviso) setState({ kind: "error", message: (err as Error).message });
    }
  }, []);

  useEffect(() => {
    void cargarLotes(true);
    void (async () => {
      try {
        const res = await fetch("/api/templates");
        const data = (await res.json()) as { templates?: PlantillaOpcion[] };
        if (res.ok) setPlantillas((data.templates ?? []).filter((t) => !t.archived));
      } catch {
        // Sin biblioteca a mano, el lote se crea igual con la plantilla activa.
        setPlantillas([]);
      }
    })();
  }, [cargarLotes]);

  // La lista se mueve solo si algo imprime: sondeo corto unicamente entonces.
  useEffect(() => {
    const t = setInterval(() => {
      if ((lotesRef.current ?? []).some((l) => l.status === "en-curso")) {
        void cargarLotes(false);
      }
    }, 3000);
    return () => clearInterval(t);
  }, [cargarLotes]);

  async function elegirArchivo(file: File | undefined) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setState({ kind: "error", message: `El archivo pesa mas de 2 MB: no es un CSV de etiquetas` });
      return;
    }
    setState({ kind: "busy", message: "Leyendo archivo..." });
    try {
      const buf = await file.arrayBuffer();
      const { texto, encoding } = decodificar(buf);
      setArchivo({ filename: file.name, content: texto, encoding });
      setNombre(file.name.replace(/\.[^.]+$/, ""));
      setPreview(null);
      setColCodigo(0);
      setColCantidad(null);
      setState({ kind: "idle" });
      // Preview inmediata con el mapeo por defecto (codigo = columna 0).
      await previsualizar(file.name, texto, true, 0, null);
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message });
    }
  }

  async function previsualizar(
    filename?: string,
    content?: string,
    encabezado?: boolean,
    codigo?: number,
    cantidad?: number | null,
  ) {
    const f = filename ?? archivo?.filename;
    const c = content ?? archivo?.content;
    if (!f || c === undefined) return;
    setState({ kind: "busy", message: "Resolviendo codigos contra el catalogo..." });
    try {
      const res = await fetch("/api/lotes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: f,
          content: c,
          hasHeader: encabezado ?? hasHeader,
          mapping: {
            code: codigo ?? colCodigo,
            qty: cantidad !== undefined ? cantidad : colCantidad,
          },
        }),
      });
      const data = (await res.json()) as PreviewMapeo & { error?: string };
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? `Error ${res.status}` });
        return;
      }
      setPreview(data);
      setColCodigo(data.mapping.code);
      setColCantidad(data.mapping.qty);
      setState({ kind: "idle" });
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message });
    }
  }

  async function crear() {
    if (!preview || !archivo || creando) return;
    if (nombre.trim() === "") {
      setState({ kind: "error", message: "El lote necesita un nombre" });
      return;
    }
    setCreando(true);
    setState({ kind: "busy", message: "Creando lote..." });
    try {
      const res = await fetch("/api/lotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nombre.trim(),
          filename: archivo.filename,
          ...(templateId !== "" ? { templateId } : {}),
          mapping: preview.mapping,
          rows: preview.rows.map((r) => ({ rawCode: r.rawCode, qty: r.qty })),
        }),
      });
      const data = (await res.json()) as LoteResumen & { error?: string };
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? `Error ${res.status}` });
        return;
      }
      setState({ kind: "idle" });
      // Limpia el asistente y muestra el lote nuevo: el siguiente paso (iniciar,
      // que IMPRIME) esta en el detalle, a proposito separado de la creacion.
      setArchivo(null);
      setPreview(null);
      setNombre("");
      await cargarLotes(false);
      setSeleccionado(data.id);
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message });
    } finally {
      setCreando(false);
    }
  }

  const primeras = (preview?.rows ?? []).filter((r) => r.status === "ok").slice(0, 5);

  return (
    <main className="flex flex-col gap-5">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={`${displayTitle} text-lg`}>Lotes con CSV</h2>
        <button type="button" onClick={() => cargarLotes(true)} className={buttonClearSecondary}>
          Actualizar
        </button>
      </section>

      <PrintStatus state={state} idleText="" />

      {/* Paso 1: subir el CSV real. */}
      <section aria-label="Paso 1: subir CSV" className={`${cardClear} flex flex-col gap-3 p-4`}>
        <h3 className={`${displayTitle} text-sm`}>1 · Subir CSV</h3>
        <div>
          <label htmlFor="csv-archivo" className={label}>
            Archivo CSV del lote
          </label>
          <input
            id="csv-archivo"
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={(e) => void elegirArchivo(e.target.files?.[0])}
            className={`${input} mt-1`}
          />
          <p className={hint}>
            Se lee en tu equipo (UTF-8 o Windows-1252 de Excel) y se manda como texto.
            Sin ERP: todo entra por CSV.
          </p>
        </div>
        {archivo && (
          <p className="text-xs text-muted">
            <span className="font-mono">{archivo.filename}</span> · leido como {archivo.encoding}
          </p>
        )}
      </section>

      {/* Paso 2: mapeo generico columnas → codigo/cantidad. */}
      {archivo && preview && (
        <section aria-label="Paso 2: mapear columnas" className={`${cardClear} flex flex-col gap-3 p-4`}>
          <h3 className={`${displayTitle} text-sm`}>2 · Mapear columnas</h3>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label htmlFor="map-codigo" className={label}>
                Columna del codigo
              </label>
              <select
                id="map-codigo"
                value={colCodigo}
                onChange={(e) => setColCodigo(Number(e.target.value))}
                className={`${select} mt-1`}
              >
                {preview.columns.map((c, i) => (
                  <option key={i} value={i}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="map-cantidad" className={label}>
                Columna de la cantidad
              </label>
              <select
                id="map-cantidad"
                value={colCantidad === null ? "" : colCantidad}
                onChange={(e) => setColCantidad(e.target.value === "" ? null : Number(e.target.value))}
                className={`${select} mt-1`}
              >
                <option value="">Sin columna (vale 1)</option>
                {preview.columns.map((c, i) => (
                  <option key={i} value={i}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={hasHeader}
                onChange={(e) => setHasHeader(e.target.checked)}
                className="size-4 accent-[#2563EB]"
              />
              La primera fila son encabezados
            </label>
            <button type="button" onClick={() => void previsualizar()} className={buttonClearSecondary}>
              Aplicar mapeo
            </button>
          </div>

          <p className="text-sm tabular-nums text-strong" aria-live="polite">
            {preview.resueltas} de {preview.total} codigos en catalogo
            {preview.resueltas < preview.total && (
              <span className="text-muted"> · las demas quedan con error y no imprimen</span>
            )}
          </p>

          {/* Primeras filas: estado por fila con el motivo verbatim. */}
          <div className="overflow-x-auto rounded-md border border-edge">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-edge bg-canvas text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className={thClear}>Fila</th>
                  <th className={thClear}>Codigo</th>
                  <th className={thClear}>Producto</th>
                  <th className={`${thClear} text-right`}>Cant.</th>
                  <th className={thClear}>Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {preview.rows.slice(0, 8).map((r) => (
                  <tr key={r.n} title={r.error ?? undefined}>
                    <td className="px-3 py-2 tabular-nums text-muted">{r.n}</td>
                    <td className="px-3 py-2 font-mono text-xs text-strong">{r.rawCode === "" ? <span className="text-muted">(vacia)</span> : r.rawCode}</td>
                    <td className="px-3 py-2 text-strong">{r.name ?? <span className="text-xs text-muted">{r.error}</span>}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-strong">{r.qty}</td>
                    <td className="px-3 py-2 text-xs">{r.status === "ok" ? "Resuelta" : "Error"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.total > 8 && (
            <p className="text-xs text-muted">Mostrando las primeras 8 de {preview.total} filas.</p>
          )}

          {/* Vista de las 5 primeras resueltas: el PNG real de cada etiqueta. */}
          {primeras.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-ink-soft">
                Vista previa de las primeras {primeras.length} resueltas (no imprime, no audita)
              </p>
              <div className="flex flex-wrap gap-3">
                {primeras.map((r) => (
                  <figure key={r.n} className="flex flex-col items-center gap-1">
                    <ThumbFila code={r.code} templateId={templateId !== "" ? templateId : undefined} />
                    <figcaption className="max-w-32 truncate font-mono text-[11px] text-muted" title={r.name ?? r.code}>
                      {r.code} ×{r.qty}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Paso 3: crear el lote (no imprime). */}
      {archivo && preview && (
        <section aria-label="Paso 3: crear lote" className={`${cardClear} flex flex-col gap-3 p-4`}>
          <h3 className={`${displayTitle} text-sm`}>3 · Crear lote</h3>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label htmlFor="lote-nombre" className={label}>
                Nombre del lote
              </label>
              <input
                id="lote-nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={120}
                placeholder="Ej. Reposicion lunes"
                className={`${input} mt-1`}
              />
            </div>
            <div className="flex-1">
              <label htmlFor="lote-plantilla" className={label}>
                Plantilla
              </label>
              <select
                id="lote-plantilla"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className={`${select} mt-1`}
              >
                <option value="">Activa al imprimir</option>
                {(plantillas ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.kind === "raw" ? " (ZPL directo)" : ""}
                  </option>
                ))}
              </select>
              <p className={hint}>Sin elegir, sale con la plantilla activa de Ajustes.</p>
            </div>
          </div>
          <div>
            <button type="button" disabled={creando} onClick={() => void crear()} className={buttonClear}>
              {creando ? "Creando..." : `Crear lote con ${preview.total} fila(s)`}
            </button>
            <p className={hint}>Crear no imprime: el lote queda en espera hasta que lo inicies.</p>
          </div>
        </section>
      )}

      {/* Lista de lotes. */}
      <section aria-label="Lotes" className="flex flex-col gap-3">
        <h3 className={`${displayTitle} text-sm`}>Lotes</h3>
        {lotes !== null && lotes.length === 0 && (
          <div className={`${cardClear} px-6 py-10 text-center`}>
            <p className="text-sm font-medium text-strong">Todavia no hay lotes.</p>
            <p className="mt-1 text-xs text-muted">Subi un CSV arriba para crear el primero.</p>
          </div>
        )}
        {lotes !== null && lotes.length > 0 && (
          <div className={`${cardClear} overflow-x-auto`}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-edge bg-canvas text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className={thClear}>Lote</th>
                  <th className={`${thClear} text-right`}>Progreso</th>
                  <th className={thClear}>Estado</th>
                  <th className={thClear}>
                    <span className="sr-only">Detalle</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {lotes.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => setSeleccionado(l.id)}
                    className="cursor-pointer hover:bg-canvas"
                  >
                    <td className="px-3 py-2">
                      <span className="font-medium text-strong">{l.name}</span>
                      <span className="block font-mono text-[11px] text-muted">{l.filename}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-strong">
                      {l.done}/{l.total}
                      {l.errors > 0 && <span className="text-error"> · {l.errors} con error</span>}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className={ESTADO_BADGE[l.status]}>{ESTADO_TEXTO[l.status]}</span>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSeleccionado(l.id);
                        }}
                        aria-pressed={seleccionado === l.id}
                        className={`${buttonClearSecondary} px-3 py-1.5 text-xs`}
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Detalle con progreso real y botones segun estado. */}
      {seleccionado && (
        <LoteDetail
          key={seleccionado}
          id={seleccionado}
          onCambio={() => cargarLotes(false)}
        />
      )}
    </main>
  );
}
