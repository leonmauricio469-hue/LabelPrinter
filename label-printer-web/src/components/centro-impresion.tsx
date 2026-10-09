"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScannerInput } from "@/components/scanner-input";
import { ProductCard } from "@/components/product-card";
import { ProductPreview } from "@/components/product-preview";
import { QuantityStepper } from "@/components/quantity-stepper";
import { PrintStatus } from "@/components/print-status";
import { lookupProducts, usePrint } from "@/components/use-print";
import { formatHistoryTs, type HistoryRecord } from "@/components/history-detail";
import { useSonido } from "@/lib/sonido";
import {
  badgeErrorClear,
  badgeOkClear,
  buttonClearPrint,
  buttonClearSecondary,
  cardClear,
  hint,
  input,
  label,
  modeTabActiveClear,
  modeTabClear,
  pillClear,
} from "@/components/ui";
import { MIN_BUSQUEDA } from "@/lib/products/product.lookup";
import type { Product } from "@/lib/products/product.types";
import {
  DEFAULT_TEMPLATE,
  TEMPLATES,
  templateById,
} from "@/lib/labels/label.template";
import type { QueueStatus } from "@/lib/printing/queue.status.types";

/**
 * Centro unificado de impresion (F11): rebuild de `/` con la piel del mockup
 * `imprimir_centro_unificado_de_producci_n`.
 *
 * Lo que hay, todo real:
 *
 * - Navegacion de modos: Rapido -> `/?tab=rapido`, Lotes via CSV ->
 *   `/?tab=lotes`, Busqueda = esta seccion (sin link, `aria-current`). F13: el
 *   centro vive en el tab Buscar del hub (`/`), asi que los modos apuntan a tabs,
 *   no a rutas.
 * - Pill PLANTILLA ACTIVA: nombre + mm de la plantilla que resuelve el
 *   `templateId` guardado. SIN metodo termico: settings no guarda ninguno y
 *   el mockup dice "(Termal Directo)" sin fuente. No se inventa.
 * - Pill COLA: trabajos EN COLA de la cola configurada, de `GET /api/printers`
 *   (`colas` reales). Sin `colas`, estado sin conteo con caption honesto.
 * - Pill SPOOL: `GET /api/printer/status` de la cola configurada. LISTO solo
 *   con cola vacia y estado ready; si no se puede saber, caption honesto.
 * - Entrada operativa: el MISMO flujo de antes (scan -> preview -> confirmar
 *   -> IMPRIMIR), con autofocus, stepper y preview real (`ProductPreview`).
 * - Densidad: slider que persiste `oscuridad`; `labels/route.ts` antepone
 *   `~SD` SOLO con valor (vacia = actual al milimetro).
 * - Sonido: beeps WebAudio en exito/error segun flags (toggles en F12).
 * - Duplicados: con `ventanaDuplicadosMs > 0`, repetir codigo en ventana no
 *   imprime ("duplicado ignorado").
 * - Historial reciente: ultimos 5 trabajos con Reimprimir/Reintentar reales.
 *
 * RECORTES DEL MOCKUP (no existen, no se inventan): ficha de telemetria de
 * producto (stock/fecha/tarifa/ERP: el catalogo no trae nada de eso), HEAD y
 * RIBBON % (Windows no los reporta), "Avanzar 1 Etiqueta" y "Calibrar Gap"
 * (el manual ZPL del repo no documenta esos comandos), buffer KB y
 * orientacion/corte (no hay fuente real).
 *
 * A una columna: el shell solo abre full-bleed en `/editor`; dos columnas
 * aqui romperian el cromo comun. La piel (cards, pills, tabs) es la del mockup.
 */

/** Ventana idle del scanner cuando settings aun no llego: la historica. */
const RETARDO_ESCANER_FALLBACK_MS = 500;

interface AjustesOperativos {
  oscuridad: string;
  ventanaDuplicadosMs: number;
  retardoEscanerMs: number;
}

/**
 * Regla anti-duplicados, pura para poder probarla sin gastar papel.
 *
 * `ultimo` es la ultima impresion EXITOSA: un intento fallido no bloquea el
 * reintento, que es justo para lo que sirve Reintentar.
 */
export function esDuplicado(
  ultimo: { code: string; at: number } | null,
  codigo: string,
  ahora: number,
  ventanaMs: number,
): boolean {
  if (ventanaMs <= 0 || !ultimo) return false;
  return ultimo.code === codigo && ahora - ultimo.at < ventanaMs;
}

export function CentroImpresion() {
  const [term, setTerm] = useState("");
  const [matches, setMatches] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [searching, setSearching] = useState(false);
  const { state, print, notify, reset } = usePrint();
  const { sonarOk, sonarError } = useSonido();

  const [ajustes, setAjustes] = useState<AjustesOperativos>({
    oscuridad: "",
    ventanaDuplicadosMs: 0,
    retardoEscanerMs: RETARDO_ESCANER_FALLBACK_MS,
  });
  const [guardandoDensidad, setGuardandoDensidad] = useState(false);
  const [plantilla, setPlantilla] = useState<{
    nombre: string;
    mm: string;
    obsoleta: string | null;
  } | null>(null);

  const [spool, setSpool] = useState<QueueStatus | null>(null);
  const [spoolSinDatos, setSpoolSinDatos] = useState(false);
  const [colaJobs, setColaJobs] = useState<number | null>(null);
  const [colaSinDatos, setColaSinDatos] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [recientes, setRecientes] = useState<HistoryRecord[] | null>(null);
  const [reimprimiendo, setReimprimiendo] = useState<string | null>(null);

  const ultimoRef = useRef<{ code: string; at: number } | null>(null);

  const busy = searching || state.kind === "busy";

  // Ajustes operativos + plantilla activa: lo que la pagina necesita de settings.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as {
          oscuridad?: unknown;
          ventanaDuplicadosMs?: unknown;
          retardoEscanerMs?: unknown;
          label?: { templateId?: unknown };
        };
        setAjustes({
          oscuridad: typeof j.oscuridad === "string" ? j.oscuridad : "",
          ventanaDuplicadosMs:
            typeof j.ventanaDuplicadosMs === "number" &&
            Number.isFinite(j.ventanaDuplicadosMs)
              ? j.ventanaDuplicadosMs
              : 0,
          retardoEscanerMs:
            typeof j.retardoEscanerMs === "number" &&
            Number.isFinite(j.retardoEscanerMs)
              ? j.retardoEscanerMs
              : RETARDO_ESCANER_FALLBACK_MS,
        });
        const id =
          typeof j.label?.templateId === "string" && j.label.templateId !== ""
            ? j.label.templateId
            : DEFAULT_TEMPLATE.id;
        const exacta = TEMPLATES.find((t) => t.id === id);
        const resuelta = templateById(id);
        setPlantilla({
          nombre: resuelta.name,
          mm: `${resuelta.widthMm} × ${resuelta.heightMm} mm`,
          obsoleta: exacta ? null : id,
        });
      } catch {
        // Sin settings no hay pagina util igual: se deja el fallback honesto.
      }
    })();
  }, []);

  const leerSpool = useCallback(async () => {
    try {
      const res = await fetch("/api/printer/status", { cache: "no-store" });
      const j = (await res.json().catch(() => null)) as QueueStatus | null;
      if (!j || typeof j.state !== "string") {
        setSpoolSinDatos(true);
        return;
      }
      setSpool(j);
      setSpoolSinDatos(false);
    } catch {
      setSpoolSinDatos(true);
    }
  }, []);

  const leerCola = useCallback(async () => {
    // El conteo sale de `GET /api/printers` (`colas` reales por nombre).
    // Hace falta el nombre de la cola CONFIGURADA, que esta en settings.
    try {
      const [rs, rp] = await Promise.all([
        fetch("/api/settings", { cache: "no-store" }),
        fetch("/api/printers", { cache: "no-store" }),
      ]);
      if (!rs.ok || !rp.ok) {
        setColaSinDatos(true);
        return;
      }
      const s = (await rs.json()) as {
        printer?: { printerName?: unknown };
      };
      const p = (await rp.json()) as {
        colas?: Array<{ nombre?: unknown; trabajos?: unknown }>;
      };
      const nombre =
        typeof s.printer?.printerName === "string"
          ? s.printer.printerName
          : null;
      if (!nombre || !Array.isArray(p.colas)) {
        setColaSinDatos(true);
        return;
      }
      const cola = p.colas.find((c) => c.nombre === nombre);
      if (!cola || typeof cola.trabajos !== "number") {
        setColaSinDatos(true);
        return;
      }
      setColaJobs(cola.trabajos);
      setColaSinDatos(false);
    } catch {
      setColaSinDatos(true);
    }
  }, []);

  const leerRecientes = useCallback(async () => {
    try {
      const res = await fetch("/api/history?limit=5", { cache: "no-store" });
      if (!res.ok) return;
      const j = (await res.json()) as { records?: HistoryRecord[] };
      setRecientes(j.records ?? []);
    } catch {
      // El historial reciente es secundario: si falla, la pagina sigue
      // imprimiendo. Se muestra el caption honesto de abajo.
    }
  }, []);

  useEffect(() => {
    void leerSpool();
    void leerCola();
    void leerRecientes();
  }, [leerSpool, leerCola, leerRecientes, refreshKey]);

  const resolve = useCallback(
    (query: string) => {
      const q = query.trim();
      if (!q) return;

      void (async () => {
        setSearching(true);
        const { products, match, error } = await lookupProducts(q);
        setSearching(false);

        if (error) {
          setMatches([]);
          setSelected(null);
          notify({ kind: "error", message: error });
          sonarError();
          return;
        }

        if (match === "too-short") {
          setMatches([]);
          setSelected(null);
          notify({
            kind: "info",
            message: `Escribe al menos ${MIN_BUSQUEDA} caracteres, o escanea el codigo de barras`,
          });
          return;
        }

        if (match === "none" || products.length === 0) {
          setMatches([]);
          setSelected(null);
          notify({
            kind: "error",
            message: `Codigo "${q}" no esta en el catalogo`,
          });
          sonarError();
          return;
        }

        if (match === "exact" && products.length === 1) {
          const product = products[0];
          setMatches([]);
          setSelected(product);
          setQty(1);
          notify({ kind: "ok", message: product.name });
          return;
        }

        setMatches(products);
        setSelected(null);
        notify({
          kind: "info",
          message: `${products.length} productos coinciden con "${q}" de forma aproximada — elige uno`,
        });
      })();
    },
    [notify, sonarError],
  );

  const clearAll = useCallback(() => {
    setTerm("");
    setMatches([]);
    setSelected(null);
    setQty(1);
    reset();
  }, [reset]);

  const doPrint = useCallback(async () => {
    if (!selected) return;
    if (
      esDuplicado(
        ultimoRef.current,
        selected.code,
        Date.now(),
        ajustes.ventanaDuplicadosMs,
      )
    ) {
      notify({
        kind: "info",
        message: `Duplicado ignorado: "${selected.code}" ya se imprimio hace un momento. No sale nada.`,
      });
      return;
    }
    const ok = await print(selected.code, qty, "normal");
    if (ok) {
      ultimoRef.current = { code: selected.code, at: Date.now() };
      setQty(1);
      sonarOk();
      setRefreshKey((k) => k + 1);
    } else {
      sonarError();
    }
  }, [print, qty, selected, ajustes.ventanaDuplicadosMs, notify, sonarOk, sonarError]);

  const persistirOscuridad = useCallback(
    async (valor: string) => {
      setAjustes((prev) => ({ ...prev, oscuridad: valor }));
      setGuardandoDensidad(true);
      try {
        // PUT parcial: la ruta lee-mergea-escribe y valida el objeto completo.
        const res = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oscuridad: valor }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as {
            error?: unknown;
          } | null;
          notify({
            kind: "error",
            message:
              typeof j?.error === "string"
                ? j.error
                : `No se pudo guardar la densidad (${res.status})`,
          });
          sonarError();
        }
      } catch (err) {
        notify({
          kind: "error",
          message: `No se pudo guardar la densidad: ${(err as Error).message}`,
        });
        sonarError();
      } finally {
        setGuardandoDensidad(false);
      }
    },
    [notify, sonarError],
  );

  const reimprimirReciente = useCallback(
    async (r: HistoryRecord) => {
      if (reimprimiendo) return;
      setReimprimiendo(r.jobId);
      try {
        const res = await fetch("/api/labels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productCode: r.code,
            qty: r.qty,
            mode: r.mode === "fast" ? "fast" : "normal",
          }),
        });
        const j = (await res.json().catch(() => null)) as {
          ok?: unknown;
          error?: unknown;
          qty?: unknown;
        } | null;
        if (!res.ok || j?.ok !== true) {
          notify({
            kind: "error",
            message:
              typeof j?.error === "string"
                ? j.error
                : `La reimpresion fallo (HTTP ${res.status})`,
          });
          sonarError();
          return;
        }
        const n = typeof j?.qty === "number" ? j.qty : r.qty;
        notify({
          kind: "ok",
          message: `${n} etiqueta${n === 1 ? "" : "s"} reimpresa${n === 1 ? "" : "s"}`,
        });
        sonarOk();
        setRefreshKey((k) => k + 1);
      } catch (err) {
        notify({
          kind: "error",
          message: `No se pudo contactar la app: ${(err as Error).message}`,
        });
        sonarError();
      } finally {
        setReimprimiendo(null);
      }
    },
    [notify, reimprimiendo, sonarError, sonarOk],
  );

  const spoolLista =
    !spoolSinDatos && spool?.state === "ready" && (spool?.jobCount ?? 0) === 0;

  return (
    <main className="flex flex-col gap-5">
      {/* Modos: tabs del hub. Busqueda es esta seccion, sin link. */}
      <nav
        aria-label="Modos de impresion"
        className={`${cardClear} flex flex-wrap items-center gap-1 p-2`}
      >
        <Link href="/?tab=rapido" className={modeTabClear}>
          Rapido / Escaner USB
        </Link>
        <span aria-current="page" className={modeTabActiveClear}>
          Busqueda Catalogo
        </span>
        <Link href="/?tab=lotes" className={modeTabClear}>
          Lotes via CSV
        </Link>
      </nav>

      {/* Pills: plantilla activa real + cola real + spool real. */}
      <section aria-label="Estado" className="flex flex-wrap gap-2">
        <span className={pillClear} title="Plantilla que imprime, segun settings">
          <span aria-hidden>◈</span>
          {plantilla
            ? `PLANTILLA ACTIVA · ${plantilla.nombre} (${plantilla.mm})`
            : "PLANTILLA ACTIVA · …"}
        </span>
        <span className={pillClear} title="Trabajos en la cola configurada (GET /api/printers)">
          <span aria-hidden>▤</span>
          {colaSinDatos || colaJobs === null
            ? "COLA · sin conteo"
            : `COLA · ${colaJobs} JOB${colaJobs === 1 ? "" : "S"}`}
        </span>
        <span
          className={`${pillClear} ${
            spoolLista
              ? "bg-success-soft text-success"
              : spool && !spoolSinDatos
                ? "bg-warn-soft text-warn"
                : ""
          }`}
          title="Estado de la cola configurada (GET /api/printer/status)"
        >
          <span
            aria-hidden
            className={`inline-block size-2 rounded-full ${
              spoolLista ? "bg-success" : spool && !spoolSinDatos ? "bg-warn" : "bg-ink-mute"
            }`}
          />
          {spoolSinDatos || !spool
            ? "SPOOL · sin datos"
            : spoolLista
              ? "SPOOL LISTO"
              : `SPOOL · ${spool.message}${spool.jobCount > 0 ? ` (${spool.jobCount} en cola)` : ""}`}
        </span>
      </section>
      {(plantilla?.obsoleta || colaSinDatos || spoolSinDatos) && (
        <p className={hint}>
          {plantilla?.obsoleta
            ? `El id guardado ("${plantilla.obsoleta}") ya no existe: se imprime con la ${plantilla.nombre}. `
            : ""}
          {colaSinDatos ? "No se pudo leer el conteo de trabajos de Windows. " : ""}
          {spoolSinDatos ? "No se pudo leer el estado de la cola." : ""}
        </p>
      )}

      <ScannerInput
        enabled={!busy}
        idleMs={ajustes.retardoEscanerMs}
        onScan={(code) => {
          setTerm("");
          resolve(code);
        }}
      />

      {/* Entrada operativa: mismo flujo de siempre, con autofocus. */}
      <section className={`${cardClear} p-5`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold tracking-wide text-strong">
            ENTRADA OPERATIVA
          </h2>
          <span className={`${pillClear} bg-primary-soft text-primary`}>
            LISTO PARA LECTURA
          </span>
        </div>
        <label htmlFor="term" className={`${label} mt-4 block`}>
          Codigo EAN-13 / referencia / descripcion
        </label>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            resolve(term);
          }}
        >
          <input
            id="term"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Escanea aqui, o escribe el codigo y pulsa Enter"
            className={`${input} h-12 flex-1 text-base`}
          />
          <button
            type="submit"
            disabled={busy || term.trim() === ""}
            className={`${buttonClearSecondary} h-12 shrink-0`}
          >
            {searching ? "Buscando..." : "Buscar"}
          </button>
        </form>
        <p className={hint}>
          El escaner USB funciona como teclado: apunta a la pagina y listo. Tambien puedes
          escribir el codigo a mano si el codigo de barras esta danado.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-edge bg-canvas p-3">
            <span className={label}>Copias a generar</span>
            <div className="mt-2">
              <QuantityStepper value={qty} onChange={setQty} disabled={busy} />
            </div>
          </div>
          <div className="rounded-md border border-edge bg-canvas p-3">
            <label htmlFor="oscuridad" className={label}>
              Densidad termica {ajustes.oscuridad === "" ? "(auto)" : `(${ajustes.oscuridad})`}
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                id="oscuridad"
                type="range"
                min={0}
                max={30}
                step={1}
                disabled={guardandoDensidad || ajustes.oscuridad === ""}
                value={ajustes.oscuridad === "" ? 15 : Number(ajustes.oscuridad)}
                onChange={(e) => void persistirOscuridad(e.target.value)}
                className="h-2 flex-1 accent-primary"
                aria-describedby="oscuridad-ayuda"
              />
              <button
                type="button"
                onClick={() => void persistirOscuridad("")}
                disabled={guardandoDensidad || ajustes.oscuridad === ""}
                className={`${buttonClearSecondary} shrink-0 px-2.5 py-1.5 text-xs`}
                title="Volver al ajuste fisico de la impresora"
              >
                Auto
              </button>
            </div>
            <p id="oscuridad-ayuda" className={hint}>
              {guardandoDensidad
                ? "Guardando…"
                : "Vacia (Auto) = comportamiento actual. Con valor se antepone `~SD` al ZPL; efecto en papel pendiente de prueba fisica."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={doPrint}
          disabled={busy || !selected}
          className={`${buttonClearPrint} mt-4 w-full`}
          aria-busy={busy}
        >
          {busy ? "Imprimiendo..." : selected ? `IMPRIMIR ×${qty}` : "IMPRIMIR AHORA"}
        </button>
      </section>

      {matches.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-baseline gap-2 text-sm font-semibold text-strong">
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold tabular-nums text-primary">
              {matches.length}
            </span>
            Elige el producto
          </h2>
          <div className="flex flex-col gap-2">
            {matches.map((product) => (
              <ProductCard
                key={product.code}
                product={product}
                onSelect={() => {
                  setSelected(product);
                  setMatches([]);
                  setQty(1);
                  notify({ kind: "ok", message: product.name });
                }}
              />
            ))}
          </div>
        </section>
      )}

      {selected && (
        <section className={`${cardClear} flex flex-col gap-5 p-5`}>
          <ProductCard product={selected} selected />
          <ProductPreview code={selected.code} />
        </section>
      )}

      <PrintStatus
        state={state}
        idleText="Escanea un producto para empezar. No necesitas hacer clic."
      />

      {/* Historial reciente: ultimos 5, con reimpresion real. */}
      <section className={`${cardClear} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold tracking-wide text-strong">
            HISTORIAL RECIENTE
          </h2>
          <Link href="/?tab=historial" className={`${buttonClearSecondary} px-3 py-1.5 text-xs`}>
            Ver todo
          </Link>
        </div>
        {recientes === null ? (
          <p className={`${hint} mt-2`}>
            No se pudo leer el historial reciente. Sigue en{" "}
            <Link href="/?tab=historial" className="underline underline-offset-2">
              Historial
            </Link>
            .
          </p>
        ) : recientes.length === 0 ? (
          <p className={`${hint} mt-2`}>
            Todavia no hay impresiones registradas. La primera etiqueta que salga aparece aca.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-edge">
            {recientes.map((r) => (
              <li
                key={r.jobId}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
              >
                <span className="font-mono text-xs text-muted">
                  {formatHistoryTs(r.ts)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-strong">
                  {r.name}
                  <span className="ml-2 font-mono text-xs font-normal text-muted">
                    ×{r.qty}
                  </span>
                </span>
                <span className={r.ok ? badgeOkClear : badgeErrorClear}>
                  {r.ok ? "Impreso" : (r.error ?? "Error")}
                </span>
                <button
                  type="button"
                  onClick={() => void reimprimirReciente(r)}
                  disabled={busy || reimprimiendo !== null}
                  className={`${buttonClearSecondary} px-3 py-1.5 text-xs`}
                >
                  {reimprimiendo === r.jobId
                    ? "Enviando…"
                    : r.ok
                      ? "Reimprimir"
                      : "Reintentar"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
