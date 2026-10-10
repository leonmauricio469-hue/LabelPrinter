"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PrintStatus, type PrintState } from "@/components/print-status";
import { Seccion1Dispositivo } from "@/components/settings-seccion1";
import { Seccion2Comportamiento } from "@/components/settings-seccion2";
import { Seccion3Catalogo } from "@/components/settings-seccion3";
import { SeccionPlantillas } from "@/components/seccion-plantillas";
import {
  buttonClear,
  buttonClearSecondary,
  cardClear,
  displayTitle,
  input,
  label as labelClass,
  pillClear,
  studioFooterClear,
} from "@/components/ui";
import type { AppSettings } from "@/lib/settings/settings.types";
import { DEFAULT_SETTINGS } from "@/lib/settings/settings.types";
import { DEFAULT_TEMPLATE } from "@/lib/labels/label.template";

/** FNV-1a de 32 bits en hex: identifica el settings guardado sin inventar datos. */
function fnv1aHex(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

/** Relativo en español para la última sincronización real (timestamp del PUT ok). */
function haceCuanto(ts: number, ahora: number): string {
  const s = Math.max(0, Math.round((ahora - ts) / 1000));
  if (s < 10) return "ahora mismo";
  if (s < 60) return `hace ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}


/**
 * Ajustes: estado y acciones viven aca.
 *
 * Sub-barra con titulo + perfil real (empresa de settings). Grilla de 2
 * columnas: izquierda secciones 1 (dispositivo) y 2 (comportamiento),
 * derecha seccion 3 (catalogo). Debajo, seccion 4 con la biblioteca de
 * plantillas reutilizada intacta (`SeccionPlantillas`: ver, elegir, crear,
 * duplicar, archivar, usar, importar, exportar). En movil, apilado.
 *
 * Esta pagina es duena del estado y de las acciones: las secciones reciben
 * valores y parches por props, y las claves de `settings.json` no se
 * renombran (`printer.*`, `label.*`, `oscuridad`, `sonido*`,
 * `ventanaDuplicadosMs`, `retardoEscanerMs`, `templateId`).
 */
export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [printers, setPrinters] = useState<string[]>([]);
  const [state, setState] = useState<PrintState>({ kind: "idle" });
  // El estado de la cola se relee despues de guardar (puede haber cambiado el
  // nombre) y despues de cada prueba.
  const [refreshKey, setRefreshKey] = useState(0);
  // Si `/editor` guardo una geometria, esta pagina es el unico sitio donde el
  // operador se entera antes de imprimir.
  const [override, setOverride] = useState<{ activo: boolean; savedAt?: string } | null>(null);
  // Timestamp del último PUT ok: la barra inferior lo muestra en relativo.
  const [lastSyncOk, setLastSyncOk] = useState<number | null>(null);
  // Reloj para que el relativo avance sin recargar.
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (lastSyncOk === null) return;
    const t = window.setInterval(() => setAhora(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, [lastSyncOk]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/editor/apply");
        if (!res.ok) return;
        const j = await res.json();
        setOverride({ activo: Boolean(j.activo), savedAt: j.savedAt ?? undefined });
      } catch {
        // Informacion secundaria: si no se lee, no se avisa.
      }
    })();
  }, [refreshKey]);

  // El formulario no espera a la lista de impresoras: /api/printers lanza
  // PowerShell y tarda, y el formulario sale de /api/settings.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) {
          setState({ kind: "error", message: `No se pudo leer la configuracion (${res.status})` });
          return;
        }
        setSettings((await res.json()) as AppSettings);
      } catch (err) {
        setState({ kind: "error", message: (err as Error).message });
      }
    })();
  }, []);

  // La lista de colas se relee con Detectar (seccion 1): en el montaje no se
  // anuncia nada para no tapar el estado con ruido.
  const cargarPrinters = useCallback(async (anunciar: boolean) => {
    try {
      const res = await fetch("/api/printers", { cache: "no-store" });
      const data = (await res.json()) as { printers?: string[]; error?: string };
      setPrinters(data.printers ?? []);
      if (anunciar) {
        if (data.error) {
          setState({
            kind: "info",
            message: `No se pudo listar las impresoras: ${data.error}. Escribe el nombre de la cola a mano.`,
          });
        } else {
          setState({
            kind: "ok",
            message: `Colas detectadas: ${data.printers?.length ?? 0}.`,
          });
        }
      } else if (data.error) {
        setState({
          kind: "info",
          message: `No se pudo listar las impresoras: ${data.error}. Escribe el nombre de la cola a mano.`,
        });
      }
    } catch (err) {
      // La lista es una comodidad: si falla se sigue escribiendo a mano.
      setPrinters([]);
      if (anunciar) {
        setState({ kind: "error", message: `No se pudo detectar colas: ${(err as Error).message}.` });
      }
    }
  }, []);

  useEffect(() => {
    void cargarPrinters(false);
  }, [cargarPrinters]);

  const patchPrinter = useCallback((patch: Partial<AppSettings["printer"]>) => {
    setSettings((prev) => (prev ? { ...prev, printer: { ...prev.printer, ...patch } } : prev));
  }, []);

  const patchLabel = useCallback((patch: Partial<AppSettings["label"]>) => {
    setSettings((prev) => (prev ? { ...prev, label: { ...prev.label, ...patch } } : prev));
  }, []);

  const patchRoot = useCallback(
    (
      patch: Partial<
        Pick<
          AppSettings,
          "oscuridad" | "sonidoOk" | "sonidoError" | "ventanaDuplicadosMs" | "retardoEscanerMs"
        >
      >,
    ) => {
      setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
    },
    [],
  );

  // PUT parcial con merge en el servidor, pero el cliente manda el objeto
  // COMPLETO y valida los enteros antes: el servidor valida el resultado
  // entero y un cuerpo con un campo roto es 400.
  const save = useCallback(async () => {
    if (!settings) return;
    const errores: string[] = [];
    if (
      !Number.isInteger(settings.printer.port) ||
      settings.printer.port <= 0 ||
      settings.printer.port > 65535
    ) {
      errores.push("el puerto debe ser un entero de 1 a 65535");
    }
    if (
      typeof settings.printer.mediaWidthMm !== "number" ||
      Number.isNaN(settings.printer.mediaWidthMm) ||
      settings.printer.mediaWidthMm < 20 ||
      settings.printer.mediaWidthMm > 170
    ) {
      errores.push("el ancho del rollo debe estar entre 20 y 170 mm");
    }
    if (!/^(|30|[12][0-9]|[0-9])$/.test(settings.oscuridad)) {
      errores.push("la oscuridad es vacia (auto) o un entero de 0 a 30");
    }
    if (
      !Number.isInteger(settings.retardoEscanerMs) ||
      settings.retardoEscanerMs < 100 ||
      settings.retardoEscanerMs > 5000
    ) {
      errores.push("el retardo del escaner debe ser un entero de 100 a 5000 ms");
    }
    if (
      !Number.isInteger(settings.ventanaDuplicadosMs) ||
      settings.ventanaDuplicadosMs < 0 ||
      settings.ventanaDuplicadosMs > 60000
    ) {
      errores.push("la ventana de duplicados debe ser un entero de 0 a 60000 ms");
    }
    if (!settings.printer.printerName.trim()) errores.push("la cola de impresora no puede estar vacia");
    if (!settings.printer.host.trim()) errores.push("el host no puede estar vacio");
    if (!settings.label.businessName.trim()) errores.push("la empresa no puede estar vacia");
    if (errores.length > 0) {
      setState({ kind: "error", message: `No se guardo: ${errores.join("; ")}.` });
      return;
    }
    setState({ kind: "busy", message: "Guardando configuracion..." });
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setState({ kind: "error", message: data.error ?? `Error ${res.status}` });
        return;
      }
      setSettings((await res.json()) as AppSettings);
      setState({ kind: "ok", message: "Configuracion guardada en settings.json" });
      setLastSyncOk(Date.now());
      setAhora(Date.now());
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message });
    }
  }, [settings]);

  const test = useCallback(async () => {
    setState({ kind: "busy", message: "Probando conexion..." });
    setRefreshKey((k) => k + 1);
    try {
      const res = await fetch("/api/printer/test", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setState({ kind: "error", message: data.error ?? `Error ${res.status}` });
        return;
      }
      setState({
        kind: "ok",
        message:
          `La cola existe y acepta trabajos. Eso NO dice si hay papel: ` +
          `mira el estado de abajo, que es el que si lo dice.`,
      });
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message });
    }
  }, []);

  // Vuelve al formulario a los valores de fábrica: no guarda solo, el
  // operador confirma con Guardar Configuración.
  const resetear = useCallback(() => {
    if (
      !window.confirm(
        "¿Restablecer configuración física a los valores predeterminados para PAPICAR 59mm @ 203 DPI?",
      )
    ) {
      return;
    }
    setSettings({
      ...DEFAULT_SETTINGS,
      printer: { ...DEFAULT_SETTINGS.printer },
      label: { ...DEFAULT_SETTINGS.label },
    });
    setState({
      kind: "info",
      message:
        "Valores de fábrica en el formulario. Pulsa Guardar Configuración para aplicarlos.",
    });
  }, []);

  // Etiqueta de diagnostico: imprime DE VERDAD por el transporte configurado.
  // Gasta 1 etiqueta y no se registra en el historial: es hardware, no venta.
  const testPrint = useCallback(async () => {
    if (!window.confirm("La etiqueta de prueba se imprime de verdad y gasta 1 etiqueta. ¿Imprimirla?")) {
      return;
    }
    setState({ kind: "busy", message: "Imprimiendo etiqueta de prueba..." });
    try {
      const res = await fetch("/api/printer/test-print", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string; destino?: string };
      if (!res.ok || !data.ok) {
        setState({ kind: "error", message: data.error ?? `Error ${res.status}` });
        setRefreshKey((k) => k + 1);
        return;
      }
      setState({
        kind: "ok",
        message:
          `Etiqueta de prueba enviada a ${data.destino ?? "la impresora"}. ` +
          `Si no sale nada, mira el estado de arriba, que es el que dice si hay papel.`,
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message });
    }
  }, []);

  if (!settings) {
    return (
      <main className="flex flex-col items-center gap-3 py-16 text-ink-mute">
        <span aria-hidden className="size-6 animate-spin rounded-full border-2 border-line-strong border-t-brand motion-reduce:animate-none" />
        <p className="text-sm">Cargando configuracion...</p>
      </main>
    );
  }

  const queueOptions = printers.includes(settings.printer.printerName)
    ? printers
    : [...printers, settings.printer.printerName];
  const empresa = settings.label.businessName.trim();
  const perfilActivo = empresa !== "" ? empresa.toUpperCase() : "SIN NOMBRE";
  // Checksum real del settings en pantalla: cambia con cada edicion y con
  // cada guardado, porque sale del objeto actual.
  const checksum = useMemo(() => fnv1aHex(JSON.stringify(settings)), [settings]);

  return (
    <main className="flex flex-col gap-5">
      <section
        aria-label="Sistema"
        className="flex flex-wrap items-baseline gap-x-3 gap-y-2 px-1"
      >
        <h2 className={`${displayTitle} text-lg`}>
          Ajustes de hardware y operación
        </h2>
        <span
          className={`${pillClear} bg-primary-soft text-primary`}
          title="Empresa guardada en settings (label.businessName)"
        >
          Perfil activo: {perfilActivo}
        </span>
      </section>

      {/* Perfil compacto (T8): empresa editable + línea plantilla/override. */}
      <section
        aria-label="Perfil"
        className={`${cardClear} flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3`}
      >
        <label htmlFor="businessName" className={labelClass}>
          Empresa
        </label>
        <input
          id="businessName"
          value={settings.label.businessName}
          onChange={(e) => patchLabel({ businessName: e.target.value })}
          className={`${input} max-w-xs flex-1`}
          title="Aparece impresa en la etiqueta (settings label.businessName)"
        />
        <p className="text-xs text-ink-soft">
          Plantilla <code>{settings.label.templateId}</code>
          {override?.activo ? ", con geometría del /editor activa" : ""} (
          <Link href="/editor" className="underline underline-offset-2">
            /editor
          </Link>
          )
        </p>
      </section>

      {/* Grilla 2 columnas (apilada en movil). */}
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <Seccion1Dispositivo
            printer={settings.printer}
            printers={queueOptions}
            refreshKey={refreshKey}
            disenoMm={DEFAULT_TEMPLATE.widthMm}
            oscuridad={settings.oscuridad}
            onPatchPrinter={patchPrinter}
            onPatchRoot={patchRoot}
            onTest={test}
            onTestPrint={testPrint}
            onDetectar={() => void cargarPrinters(true)}
          />

          <Seccion2Comportamiento
            sonidoOk={settings.sonidoOk}
            sonidoError={settings.sonidoError}
            ventanaDuplicadosMs={settings.ventanaDuplicadosMs}
            retardoEscanerMs={settings.retardoEscanerMs}
            onPatch={patchRoot}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Seccion3Catalogo
            label={settings.label}
            override={override}
            onPatchLabel={patchLabel}
            onImportado={(s) => {
              setSettings(s);
              setLastSyncOk(Date.now());
              setAhora(Date.now());
              setRefreshKey((k) => k + 1);
            }}
          />
        </div>
      </div>

      {/* Seccion 4: la biblioteca real, reutilizada sin cambios. La clave
          fuerza el re-montaje cuando el atajo de la seccion 3 activa otra
          plantilla, para que la marca de activa quede al dia. */}
      <section aria-label="Plantillas">
        <SeccionPlantillas key={settings.label.templateId} />
      </section>

      {/* Barra inferior: sync real + checksum real + reset + guardar. */}
      <section
        aria-label="Acciones de configuración"
        className={`${cardClear} sticky bottom-0 z-10 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-ink-soft">
          <span
            title={
              lastSyncOk === null
                ? "Todavía no se guardó en esta sesión"
                : `Último PUT ok: ${new Date(lastSyncOk).toLocaleString("es-ES")}`
            }
          >
            Última sincronización correcta{" "}
            {lastSyncOk === null
              ? "pendiente (guarda para sincronizar)"
              : haceCuanto(lastSyncOk, ahora)}
          </span>
          <span title="FNV-1a del settings en pantalla: cambia con cada edición y cada guardado">
            PARAM_CHECKSUM: 0x{checksum}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={resetear}
            className={buttonClearSecondary}
            title="Vuelve el formulario a DEFAULT_SETTINGS (PAPICAR 59mm @ 203 DPI); no guarda solo"
          >
            Restablecer valores
          </button>
          <button
            type="button"
            onClick={save}
            className={buttonClear}
            title="Valida y guarda todo el objeto (PUT /api/settings)"
          >
            Guardar configuración
          </button>
        </div>
      </section>

      <PrintStatus state={state} idleText="" />

      {/* Pie: solo hechos reales de settings. */}
      <footer className={studioFooterClear}>
        {settings.printer.printerName.trim() !== "" ? (
          <span title="Cola de Windows (settings printer.printerName)">
            Impresora objetivo: {settings.printer.printerName.trim()} (Raw ZPL)
          </span>
        ) : (
          <span>Impresora objetivo: sin cola configurada</span>
        )}
        <span title="Fuente real de estos ajustes">
          Origen: data/settings.json
        </span>
        <span title="El builder calcula a 203 (8 dots/mm)">
          Cabezal 203 DPI (8 dots/mm)
        </span>
        <span>PAPICAR S.L. © 2025</span>
      </footer>
    </main>
  );
}
