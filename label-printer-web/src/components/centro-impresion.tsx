"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScannerInput } from "@/components/scanner-input";
import { ProductCard } from "@/components/product-card";
import { ProductSearch } from "@/components/product-search";
import { ProductPreview } from "@/components/product-preview";
import { QuantityStepper } from "@/components/quantity-stepper";
import { PrintStatus } from "@/components/print-status";
import { lookupProducts, usePrint } from "@/components/use-print";
import { formatHistoryTs, type HistoryRecord } from "@/components/history-detail";
import { SeccionRapido } from "@/components/seccion-rapido";
import { SeccionHistorial } from "@/components/seccion-historial";
import { SeccionPlantillas } from "@/components/seccion-plantillas";
import { SeccionLotes } from "@/components/seccion-lotes";
import { useSonido } from "@/lib/sonido";
import {
  badgeErrorClear,
  badgeOkClear,
  buttonClearPrint,
  buttonClearSecondary,
  cardClear,
  dialogClear,
  hint,
  label,
  modeTabActiveClear,
  modeTabClear,
  overlayClear,
  pillClear,
  studioFooterClear,
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
 * Imprimir EXACTA al mockup `imprimir_centro_unificado_de_producci_n` (F14).
 * Re-composicion del hub F13: la barra de tabs interna
 * (Buscar/Rapido/Historial/Plantillas/Lotes) se va; los modos son in-place
 * con montaje excluyente (solo un modo visible a la vez, asi `ScannerInput`
 * —listener global de teclado: dos montados = doble impresion— queda en UNA
 * sola instancia viva), la biblioteca vive en la pill PLANTILLA ACTIVA y el
 * historial completo en un desplegable. Cero logica nueva, cero cambios en
 * lib/api/data: cada bloque reutiliza su pieza tal cual, mismos endpoints.
 *
 * Lo real, y de donde sale:
 *
 * - Pill de estado del header: la MISMA composicion honesta de
 *   `PrinterStatusBanner` (`Impresora/Bloqueada: {message}{ · N en cola}`),
 *   sobre el MISMO `GET /api/printer/status` que ya se leia.
 * - Nav Imprimir (esta pagina, sin link) / Editor (`/editor`): rutas reales
 *   con `Link` (guia Next `dist/docs/.../link.md`). `/settings` no duplica
 *   tab aqui: se alcanza desde `AppNav`, el boton Configurar del shell, el
 *   drawer y la URL directa.
 * - COLA: N JOBS: el `JobCount` existente de `GET /api/printers` + cola
 *   configurada de settings. Sin conteo, caption honesto.
 * - Soporte: modal con version REAL del package (`GET /api/editor/preview`,
 *   la misma que pinta el footer del editor), rutas `data/` (las que abren
 *   los stores en `src/lib`, ver nota del modal), cola configurada
 *   (`printer.printerName` de settings) y link a `/teclado`.
 * - Avatar: iniciales REALES de `label.businessName` de settings
 *   ("PA PICAR" -> "PP"); sin settings, "OP" de operador.
 * - PLANTILLA ACTIVA clicable: nombre + mm reales (resuelve el `templateId`
 *   guardado) y despliega `SeccionPlantillas` tal cual. SIN metodo termico:
 *   settings no guarda ninguno y el mockup dice "(Termal Directo)" sin
 *   fuente. No se inventa.
 * - ENTRADA OPERATIVA: el MISMO flujo manual (scan+autofocus, qty, densidad
 *   `~SD` condicional, IMPRIMIR AHORA, beeps, anti-duplicados).
 * - PREVISUALIZACION: `ProductPreview` (el PNG del ZPL real) + reglas con
 *   los mm reales de la plantilla + refresh (remonta la vista y refetch) +
 *   Buffer con los bytes REALES del PNG (misma URL, `blob.size`) +
 *   Orientacion/Corte como hechos reales FIJOS (ver nota: el builder no
 *   emite `^PO` ni corte).
 * - HISTORIAL DE IMPRESION: recientes (ultimos 5, Reimprimir/Reintentar
 *   reales) + desplegable con `SeccionHistorial` tal cual (filtros, KPIs,
 *   detalle, CSV reales).
 * - Footer: motor local estatico y honesto (la redaccion del footer F9 del
 *   editor), impresora objetivo (cola+puerto del status real), origen
 *   override-vs-codigo (`GET /api/editor/apply`, como el editor), DPI 203
 *   (8 dots/mm: `MM_TO_DOTS` en `label.template.ts`).
 *
 * OMITIDOS DEL MOCKUP (sin fuente de datos, no se inventan): ficha de
 * telemetria de producto (stock/fecha/tarifa/ERP: el catalogo no trae nada
 * de eso), HEAD y RIBBON % (Windows no los reporta), "Terminal" y firma
 * legal (sin fuente), KPIs sobre los recientes (el total solo lo sabe el
 * historial completo, que esta en el desplegable).
 *
 * CABLEADO CON PRUEBA FISICA PENDIENTE (orden del usuario: la pantalla
 * exacta primero, el cableado despues): "Avanzar 1 Etiqueta" (`~PH` suelto) y
 * "Calibrar Gap" (`~JC` suelto + `^XA^JUS^XZ`) van a
 * `POST /api/printer/mantenimiento`, por el mismo `transport.send()` de la
 * impresion normal. Comandos oficiales Zebra, efecto EN PAPEL pendiente de
 * prueba fisica en este equipo: la UI lo dice y no finge exito.
 *
 * Nota de anidado: `SeccionRapido/Lotes/Plantillas/Historial` traen su
 * propio `<main>` (asi los dejo F13) y aqui quedan dentro del `<main>` de
 * la pagina. No se tocan (estan fuera de las superficies F14); el
 * navegador lo tolera y el gate estructural no lo juzga.
 */

/** Ventana idle del scanner cuando settings aun no llego: la historica. */
const RETARDO_ESCANER_FALLBACK_MS = 500;

/** 203 DPI = 8 dots/mm: `MM_TO_DOTS` en `label.template.ts`, pie F9. */
const DPI_REAL = 203;
const DOTS_POR_MM = 8;

/** Modos in-place: estado, no navegacion. */
export type ModoImpresion = "busqueda" | "rapido" | "lotes";

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

/** Iniciales de "PA PICAR" -> "PP". Pura: sin settings no hay avatar real. */
export function inicialesDe(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter((p) => p !== "");
  if (partes.length === 0) return "OP";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
}

/** "2.4 KB" honesto: los bytes que de verdad llegaron por el cable. */
function formatoKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Bytes REALES del PNG de la vista previa: la MISMA URL que `ProductPreview`
 * (`GET /api/labels/preview?code=`), leyendo `blob.size`. Sin plantilla en
 * la query a proposito: es la misma que enseña la imagen (la activa).
 */
function BufferBytes({ code, bust }: { code: string; bust: number }) {
  const [bytes, setBytes] = useState<number | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setBytes(null);
    setFallo(false);
    void (async () => {
      try {
        const res = await fetch(
          `/api/labels/preview?code=${encodeURIComponent(code)}`,
          { signal: ctrl.signal },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (!ctrl.signal.aborted) setBytes(blob.size);
      } catch {
        if (!ctrl.signal.aborted) setFallo(true);
      }
    })();
    return () => ctrl.abort();
  }, [code, bust]);

  if (fallo || bytes === null) {
    return (
      <span>
        {fallo
          ? "Buffer: sin datos (no se pudo descargar la vista previa)"
          : "Buffer: midiendo…"}
      </span>
    );
  }
  return <span>Buffer: {formatoKB(bytes)} (Render ZPL Instantáneo)</span>;
}

/**
 * Modal de soporte: solo hechos reales.
 *
 * - Version: `GET /api/editor/preview` (`version` = `package.json` tal cual;
 *   el MISMO endpoint que pinta la `v` del footer del editor).
 * - Rutas `data/`: las que abren los stores (`catalog.json`,
 *   `settings.json`, `plantillas.json`, `plantilla-override.json`,
 *   `print-history.jsonl`, `lotes.json` — ver `*_FILE` en `src/lib`).
 * - Cola configurada: `printer.printerName` de `GET /api/settings`.
 * - Link a `/teclado` (diagnostico, fuera del nav como hoy).
 */
function SoporteModal({
  colaConfigurada,
  onCerrar,
}: {
  colaConfigurada: string | null;
  onCerrar: () => void;
}) {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/editor/preview", { signal: ctrl.signal });
        if (!res.ok) return;
        const j = (await res.json()) as { version?: unknown };
        if (!ctrl.signal.aborted && typeof j.version === "string" && j.version !== "") {
          setVersion(j.version);
        }
      } catch {
        // Sin version no hay modal util a medias: se muestra "sin datos".
      }
    })();
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    const alTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", alTeclar);
    return () => document.removeEventListener("keydown", alTeclar);
  }, [onCerrar]);

  return (
    <div
      className={overlayClear}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="soporte-titulo" className={dialogClear}>
        <div className="flex items-center justify-between gap-2">
          <h2 id="soporte-titulo" className="text-sm font-bold tracking-wide text-strong">
            SOPORTE
          </h2>
          <button
            type="button"
            autoFocus
            onClick={onCerrar}
            className={`${buttonClearSecondary} px-3 py-1.5 text-xs`}
          >
            Cerrar
          </button>
        </div>
        <dl className="mt-4 flex flex-col gap-3 text-sm">
          <div className="rounded-md border border-edge bg-canvas p-3">
            <dt className="text-xs text-muted">Version</dt>
            <dd className="mt-0.5 font-mono font-semibold text-strong">
              {version === null ? "v… (sin datos)" : `v${version}`}
            </dd>
          </div>
          <div className="rounded-md border border-edge bg-canvas p-3">
            <dt className="text-xs text-muted">Cola configurada</dt>
            <dd className="mt-0.5 font-mono font-semibold text-strong">
              {colaConfigurada ?? "sin datos"}
            </dd>
          </div>
          <div className="rounded-md border border-edge bg-canvas p-3">
            <dt className="text-xs text-muted">Rutas data/</dt>
            <dd className="mt-0.5 font-mono text-xs leading-relaxed text-strong">
              data/catalog.json
              <br />
              data/settings.json
              <br />
              data/plantillas.json
              <br />
              data/plantilla-override.json
              <br />
              data/print-history.jsonl
              <br />
              data/lotes.json
            </dd>
          </div>
        </dl>
        <Link
          href="/teclado"
          className={`${buttonClearSecondary} mt-4 w-full text-xs`}
        >
          Abrir /teclado (diagnostico)
        </Link>
      </div>
    </div>
  );
}

export function CentroImpresion({
  modoInicial = "busqueda",
  biblioInicial = false,
  historialInicial = false,
}: {
  modoInicial?: ModoImpresion;
  biblioInicial?: boolean;
  historialInicial?: boolean;
}) {
  const [modo, setModo] = useState<ModoImpresion>(modoInicial);
  const [biblioAbierta, setBiblioAbierta] = useState(biblioInicial);
  const [historialExpandido, setHistorialExpandido] = useState(historialInicial);
  const [soporteAbierto, setSoporteAbierto] = useState(false);

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
    anchoMm: number;
    altoMm: number;
    obsoleta: string | null;
  } | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [colaConfigurada, setColaConfigurada] = useState<string | null>(null);
  const [hayOverride, setHayOverride] = useState<boolean | null>(null);

  const [spool, setSpool] = useState<QueueStatus | null>(null);
  const [spoolSinDatos, setSpoolSinDatos] = useState(false);
  const [colaJobs, setColaJobs] = useState<number | null>(null);
  const [colaSinDatos, setColaSinDatos] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [previewKey, setPreviewKey] = useState(0);

  const [recientes, setRecientes] = useState<HistoryRecord[] | null>(null);
  const [reimprimiendo, setReimprimiendo] = useState<string | null>(null);

  /**
   * Mantenimiento de papel: Avanzar (`~PH`) y Calibrar (`~JC` + `^JUS`).
   *
   * Estado local, sin tocar el estado de impresion ni el foco: los botones no
   * usan `autoFocus` ni llaman a `.focus()`, y `ScannerInput` sigue montado una
   * sola vez en el modo busqueda. Calibrar pide confirmacion en dos pasos (gasta
   * de 1 a 4 etiquetas) en vez de `window.confirm`, que bloquearia el teclado.
   */
  const [mantenimientoBusy, setMantenimientoBusy] = useState<"feed" | "calibrar" | null>(null);
  const [mantenimientoMsg, setMantenimientoMsg] = useState<string | null>(null);
  const [mantenimientoError, setMantenimientoError] = useState<string | null>(null);
  const [confirmaCalibrar, setConfirmaCalibrar] = useState(false);

  const ultimoRef = useRef<{ code: string; at: number } | null>(null);

  const busy = searching || state.kind === "busy";

  // Ajustes operativos + plantilla activa + negocio: lo que la pagina necesita
  // de settings (una sola respuesta, tres lecturas honestas).
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as {
          oscuridad?: unknown;
          ventanaDuplicadosMs?: unknown;
          retardoEscanerMs?: unknown;
          printer?: { printerName?: unknown };
          label?: { templateId?: unknown; businessName?: unknown };
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
          anchoMm: resuelta.widthMm,
          altoMm: resuelta.heightMm,
          obsoleta: exacta ? null : id,
        });
        setBusinessName(
          typeof j.label?.businessName === "string" && j.label.businessName.trim() !== ""
            ? j.label.businessName
            : null,
        );
        setColaConfigurada(
          typeof j.printer?.printerName === "string" && j.printer.printerName !== ""
            ? j.printer.printerName
            : null,
        );
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
      if (nombre !== null && nombre !== "") setColaConfigurada(nombre);
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

  // Origen override-vs-codigo: `GET /api/editor/apply` (`activo`), el MISMO
  // que lee el editor para su footer. Sin override se imprime con el codigo.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/editor/apply", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as { activo?: unknown };
        setHayOverride(j.activo === true);
      } catch {
        // Origen desconocido: el footer lo dice, no lo inventa.
      }
    })();
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

  // Elegir un producto ya resuelto (sugerencia del predictivo o tarjeta de la
  // lista de coincidencias): NO re-resuelve, solo selecciona. El submit del
  // form y el scan siguen usando `resolve`.
  const elegirProducto = useCallback(
    (product: Product) => {
      setSelected(product);
      setMatches([]);
      setQty(1);
      notify({ kind: "ok", message: product.name });
    },
    [notify],
  );

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

  /**
   * Envia `feed` (`~PH`) o `calibrar` (`~JC` + `^JUS`) a
   * `POST /api/printer/mantenimiento`. El error se muestra verbatim (el mensaje
   * real del transporte), sin codigos inventados. No toca el historial de
   * ventas: es hardware, igual que la prueba de diagnostico.
   */
  const ejecutarMantenimiento = useCallback(
    async (accion: "feed" | "calibrar") => {
      if (mantenimientoBusy) return;
      setMantenimientoBusy(accion);
      setMantenimientoMsg(null);
      setMantenimientoError(null);
      try {
        const res = await fetch("/api/printer/mantenimiento", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion }),
        });
        const j = (await res.json().catch(() => null)) as {
          ok?: unknown;
          error?: unknown;
        } | null;
        if (!res.ok || j?.ok !== true) {
          setMantenimientoError(
            typeof j?.error === "string" ? j.error : `Fallo (HTTP ${res.status})`,
          );
          sonarError();
          return;
        }
        setMantenimientoMsg(
          accion === "feed"
            ? "Avance enviado. Efecto en papel pendiente de prueba fisica."
            : "Calibracion enviada. Efecto en papel pendiente de prueba fisica.",
        );
        setConfirmaCalibrar(false);
        sonarOk();
      } catch (err) {
        setMantenimientoError(`No se pudo contactar la app: ${(err as Error).message}`);
        sonarError();
      } finally {
        setMantenimientoBusy(null);
      }
    },
    [mantenimientoBusy, sonarError, sonarOk],
  );

  const spoolLista =
    !spoolSinDatos && spool?.state === "ready" && (spool?.jobCount ?? 0) === 0;

  // Pill de estado del header: la misma composicion honesta de hoy
  // (`PrinterStatusBanner`: Impresora/Bloqueada + mensaje + cola), sobre el
  // mismo `GET /api/printer/status`.
  const etiquetaSpool =
    spool?.state === "blocked" || spool?.state === "missing" ? "Bloqueada" : "Impresora";
  const colaSpool = spool && spool.jobCount > 0 ? ` · ${spool.jobCount} en cola` : "";
  const textoEstado =
    spoolSinDatos || !spool
      ? "Impresora: sin datos"
      : `${etiquetaSpool}: ${spool.message}${colaSpool}`;

  const enBusqueda = modo === "busqueda";

  return (
    <main className="flex flex-col gap-5">
      {/* Header F14: estado real + nav real + cola real + soporte + avatar. */}
      <header className={`${cardClear} flex flex-wrap items-center gap-x-3 gap-y-2 p-2.5`}>
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
          {textoEstado}
        </span>
        <nav aria-label="Modulos" className="flex items-center gap-1">
          <span aria-current="page" className={modeTabActiveClear}>
            Imprimir
          </span>
          <Link href="/editor" className={modeTabClear}>
            Editor
          </Link>
        </nav>
        <span className={`${pillClear} ml-auto font-mono`} title="Trabajos en la cola configurada (GET /api/printers)">
          {colaSinDatos || colaJobs === null ? "COLA: sin conteo" : `COLA: ${colaJobs} JOBS`}
        </span>
        <button
          type="button"
          onClick={() => setSoporteAbierto(true)}
          className={`${buttonClearSecondary} px-3 py-1.5 text-xs`}
        >
          Soporte
        </button>
        <span
          className="grid size-7 shrink-0 place-items-center rounded-full border border-edge bg-primary-soft text-xs font-bold text-primary"
          title={businessName === null ? "Operador" : `Operador · ${businessName}`}
        >
          {businessName === null ? "OP" : inicialesDe(businessName)}
        </span>
      </header>
      {soporteAbierto && (
        <SoporteModal colaConfigurada={colaConfigurada} onCerrar={() => setSoporteAbierto(false)} />
      )}

      {/* Modos in-place: botones de estado, no navegacion. Montaje excluyente:
          solo un modo vive a la vez, asi ScannerInput queda en UNA instancia. */}
      <nav
        aria-label="Modos de impresion"
        className={`${cardClear} flex flex-wrap items-center gap-1 p-2`}
      >
        <button
          type="button"
          aria-pressed={modo === "rapido"}
          onClick={() => setModo("rapido")}
          className={modo === "rapido" ? modeTabActiveClear : modeTabClear}
        >
          Rapido / Escaner USB
        </button>
        <button
          type="button"
          aria-pressed={enBusqueda}
          onClick={() => setModo("busqueda")}
          className={enBusqueda ? modeTabActiveClear : modeTabClear}
        >
          Busqueda Catalogo
        </button>
        <button
          type="button"
          aria-pressed={modo === "lotes"}
          onClick={() => setModo("lotes")}
          className={modo === "lotes" ? modeTabActiveClear : modeTabClear}
        >
          Lotes via CSV
        </button>
      </nav>

      {/* PLANTILLA ACTIVA real (clicable: despliega la biblioteca) + SPOOL. */}
      <section aria-label="Estado" className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-expanded={biblioAbierta}
          onClick={() => setBiblioAbierta((v) => !v)}
          className={pillClear}
          title="Plantilla que imprime, segun settings. Activa para gestionar la biblioteca."
        >
          <span aria-hidden>◈</span>
          {plantilla
            ? `PLANTILLA ACTIVA · ${plantilla.nombre} (${plantilla.mm})`
            : "PLANTILLA ACTIVA · …"}
        </button>
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
      {biblioAbierta && (
        <section aria-label="Biblioteca de plantillas">
          <SeccionPlantillas />
        </section>
      )}

      {modo === "rapido" && <SeccionRapido />}
      {modo === "lotes" && <SeccionLotes />}

      {enBusqueda && (
        <>
          <ScannerInput
            enabled={!busy}
            idleMs={ajustes.retardoEscanerMs}
            onScan={(code) => {
              setTerm("");
              resolve(code);
            }}
          />

          {/* Entrada operativa: mismo flujo de siempre, con autofocus. */}
          {/* Lado a lado como el mockup: entrada a la izquierda, preview a la derecha
              (en movil apilado). La tarjeta del elegido va con la entrada. */}
          <div className="grid items-start gap-5 xl:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-5">
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
              <ProductSearch
                term={term}
                onTermChange={setTerm}
                onPick={elegirProducto}
                disabled={busy}
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
            {/* Mantenimiento de papel: comandos oficiales Zebra por la misma via
                que la impresion (`POST /api/printer/mantenimiento`). Efecto EN PAPEL
                pendiente de prueba fisica en este equipo: la UI lo dice debajo. */}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void ejecutarMantenimiento("feed")}
                disabled={mantenimientoBusy !== null}
                title="Avanza una etiqueta (~PH, comando oficial Zebra). Pendiente de prueba fisica en este equipo."
                className={`${buttonClearSecondary} text-xs`}
              >
                {mantenimientoBusy === "feed" ? "Avanzando…" : "Avanzar 1 Etiqueta"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmaCalibrar(true)}
                disabled={mantenimientoBusy !== null || confirmaCalibrar}
                title="Calibra el sensor de gap (~JC + ^JUS, comando oficial Zebra). Gasta de 1 a 4 etiquetas. Pendiente de prueba fisica en este equipo."
                className={`${buttonClearSecondary} text-xs`}
              >
                Calibrar Gap
              </button>
            </div>
            <p className={hint}>
              Comandos oficiales Zebra, pendientes de prueba fisica en este equipo. Avanzar
              gasta 1 etiqueta; Calibrar gasta de 1 a 4.
            </p>
            {confirmaCalibrar && (
              <div className="mt-2 rounded-md border border-edge bg-canvas p-3">
                <p className="text-xs text-strong">
                  La calibracion hace avanzar de 1 a 4 etiquetas. ¿Confirmar?
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void ejecutarMantenimiento("calibrar")}
                    disabled={mantenimientoBusy !== null}
                    className={`${buttonClearSecondary} px-3 py-1.5 text-xs`}
                  >
                    {mantenimientoBusy === "calibrar" ? "Calibrando…" : "Confirmar calibracion"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmaCalibrar(false)}
                    disabled={mantenimientoBusy !== null}
                    className={`${buttonClearSecondary} px-3 py-1.5 text-xs`}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            {mantenimientoMsg && (
              <p role="status" className={`${hint} mt-1`}>
                {mantenimientoMsg}
              </p>
            )}
            {mantenimientoError && (
              <p role="alert" className="mt-1 text-xs font-medium text-danger">
                {mantenimientoError}
              </p>
            )}
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
                    onSelect={() => elegirProducto(product)}
                  />
                ))}
              </div>
            </section>
          )}

          {selected && (
            <section className={`${cardClear} flex flex-col gap-5 p-5`}>
              <ProductCard product={selected} selected />
            </section>
          )}
          </div>
          <div className="min-w-0">

          {/* Previsualizacion a escala: el PNG del ZPL real + reglas con los
              mm de la plantilla + Buffer en bytes reales. Orientacion y corte
              son hechos FIJOS: `zpl.builder.ts` no emite `^PO` (siempre Normal
              0°) ni comando de corte (el cortador queda OFF). */}
          <section className={`${cardClear} p-5`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold tracking-wide text-strong">
                PREVISUALIZACION A ESCALA ({plantilla === null ? "… mm" : plantilla.mm})
              </h2>
              <div className="flex items-center gap-2">
                <span className={`${pillClear} font-mono`}>{DPI_REAL} DPI RASTER</span>
                <button
                  type="button"
                  onClick={() => setPreviewKey((k) => k + 1)}
                  disabled={!selected}
                  className={`${buttonClearSecondary} px-2.5 py-1.5 text-xs`}
                  title="Refrescar vista previa (vuelve a pedir el PNG real)"
                >
                  Refrescar
                </button>
              </div>
            </div>
            <div className="mt-3 rounded-md border border-edge bg-canvas p-4">
              <div className="flex items-center justify-between font-mono text-[10px] text-muted">
                <span>0 mm</span>
                <span>{plantilla === null ? "… mm" : `${plantilla.anchoMm} mm`}</span>
              </div>
              {selected ? (
                // Lienzo acotado estilo mockup: la etiqueta centrada a tamano moderado
                // sobre grilla, no a todo el ancho del panel. El PNG manda; el wrapper
                // solo lo centra y le pone fondo.
                <div className="mt-2 grid place-items-center rounded-md border border-edge bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:20px_20px] p-6">
                  <div className="w-full max-w-[520px]">
                    <ProductPreview key={previewKey} code={selected.code} />
                  </div>
                </div>
              ) : (
                <div className="mt-2 grid place-items-center rounded-md border border-edge bg-panel p-8">
                  <p className="text-sm text-muted">
                    Escanea un producto para ver su etiqueta real
                  </p>
                </div>
              )}
              <div className="mt-2 font-mono text-[10px] text-muted">
                {plantilla === null ? "… mm" : `${plantilla.altoMm} mm`}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-muted">
              <span>
                {selected ? (
                  <BufferBytes code={selected.code} bust={previewKey} />
                ) : (
                  "Buffer: sin etiqueta (escanea un producto)"
                )}
              </span>
              <span>Orientación: Normal (0°) · Corte: Automático OFF</span>
            </div>
          </section>
          </div>
          </div>

          <PrintStatus
            state={state}
            idleText="Escanea un producto para empezar. No necesitas hacer clic."
          />

          {/* Historial de impresion: recientes con reimpresion real +
              desplegable con el historial completo (`SeccionHistorial`). */}
          <section className={`${cardClear} p-5`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold tracking-wide text-strong">
                HISTORIAL DE IMPRESION
              </h2>
              <button
                type="button"
                aria-expanded={historialExpandido}
                onClick={() => setHistorialExpandido((v) => !v)}
                className={`${buttonClearSecondary} px-3 py-1.5 text-xs`}
              >
                {historialExpandido ? "Ocultar completo" : "Ver completo"}
              </button>
            </div>
            {recientes === null ? (
              <p className={`${hint} mt-2`}>
                No se pudo leer el historial reciente. Abre el completo para intentarlo de nuevo.
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
            {historialExpandido && (
              <div className="mt-4 border-t border-edge pt-4">
                <SeccionHistorial />
              </div>
            )}
          </section>
        </>
      )}

      {/* Footer F14: solo hechos reales (redaccion honesta del pie F9). */}
      <footer className={studioFooterClear}>
        <span>
          <span className="inline-block size-1.5 rounded-full bg-slate-500" /> Motor ZPL: local
          (en proceso)
        </span>
        <span>
          Impresora objetivo:{" "}
          {spool && spool.raw.found && spool.raw.queue !== ""
            ? `${spool.raw.queue}${spool.raw.port ? ` (${spool.raw.port})` : ""}`
            : "sin datos"}
        </span>
        <span>
          Origen:{" "}
          {hayOverride === null ? "…" : hayOverride ? "data/plantilla-override.json" : "codigo"}
        </span>
        <span className="ml-auto">
          DPI: {DPI_REAL} ({DOTS_POR_MM} dots/mm)
        </span>
      </footer>
    </main>
  );
}
