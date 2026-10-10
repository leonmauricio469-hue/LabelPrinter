"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PrintStatus, type PrintState } from "@/components/print-status";
import { Seccion1Dispositivo } from "@/components/settings-seccion1";
import { Seccion2Comportamiento } from "@/components/settings-seccion2";
import { Seccion3Catalogo } from "@/components/settings-seccion3";
import { Telemetria } from "@/components/settings-telemetria";
import {
  badgeArchivedClear,
  buttonClear,
  buttonClearSecondary,
  cardClear,
  displayTitle,
  hint,
  input,
  label as labelClass,
  pillClear,
} from "@/components/ui";
import type { AppSettings } from "@/lib/settings/settings.types";
import { DEFAULT_TEMPLATE } from "@/lib/labels/label.template";

/** Insignia honesta para lo estatico: texto del mockup, sin fuente real. */
const mockBadge = `${badgeArchivedClear} ml-2 align-middle`;
const mockTitle =
  "Texto del mockup sin fuente real: no cableado, no son datos en vivo.";

/** Bloque de datos de apoyo: no es un campo, no debe parecerse a uno. */
const note =
  "rounded-md border border-line bg-surface-sunken px-3 py-3 text-xs leading-relaxed text-ink-soft";

/** `input` compartido con la separacion respecto de la etiqueta de arriba. */
const inputClass = `mt-1.5 ${input}`;

/**
 * Ajustes replica del template 1:1, sin inventar datos (T7).
 *
 * Sub-barra del template (SISTEMA + PERFIL ACTIVO real + DAEMON/LATENCIA
 * estaticos) y grilla de 2 columnas estilo ZPL Studio: izquierda secciones
 * 1 (dispositivo) y 2 (comportamiento), derecha seccion 3 (catalogo) y
 * telemetria. En movil, apilado.
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
        <span aria-hidden className="size-6 animate-spin rounded-full border-2 border-line-strong border-t-brand" />
        <p className="text-sm">Cargando configuracion...</p>
      </main>
    );
  }

  const queueOptions = printers.includes(settings.printer.printerName)
    ? printers
    : [...printers, settings.printer.printerName];
  const empresa = settings.label.businessName.trim();
  const perfilActivo = empresa !== "" ? empresa.toUpperCase() : "SIN NOMBRE";

  return (
    <main className="flex flex-col gap-5">
      {/* T7: sub-barra del template — titulo + perfil real + estaticos honestos. */}
      <section
        aria-label="Sistema"
        className={`${cardClear} flex flex-wrap items-center gap-x-3 gap-y-2 p-3`}
      >
        <h2 className={`${displayTitle} text-sm`}>
          SISTEMA / AJUSTES DE HARDWARE &amp; OPERACIÓN
        </h2>
        <span
          className={`${pillClear} bg-primary-soft text-primary`}
          title="Empresa guardada en settings (label.businessName)"
        >
          PERFIL ACTIVO: {perfilActivo}
        </span>
        <span className="flex flex-wrap items-center gap-2 sm:ml-auto" title={mockTitle}>
          <span className={pillClear}>DAEMON ZPL v2.4.1 CORRIENDO</span>
          <span className={pillClear}>LATENCIA USB: {"<"}1.8ms</span>
          <span className={mockBadge}>mockup · sin datos</span>
        </span>
      </section>

      {/* Perfil: la empresa cableada (alimenta PERFIL ACTIVO); respaldo sin fuente. */}
      <section className={`${cardClear} flex flex-col gap-4 p-5`}>
        <h3 className={`${displayTitle} text-base`}>Perfil</h3>
        <div>
          <label htmlFor="businessName" className={labelClass}>
            Empresa
          </label>
          <input
            id="businessName"
            value={settings.label.businessName}
            onChange={(e) => patchLabel({ businessName: e.target.value })}
            className={inputClass}
          />
          <p className={hint}>
            Aparece impresa en la etiqueta. Cambiarla aqui no reimprime nada: toma efecto en la
            proxima tirada.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled
            title="Sin fuente real: exportar el perfil no esta cableado."
            className={buttonClearSecondary}
          >
            Exportar perfil
          </button>
          <button
            type="button"
            disabled
            title="Sin fuente real: importar el perfil no esta cableado."
            className={buttonClearSecondary}
          >
            Importar perfil
          </button>
        </div>
        <p className={hint}>
          Exportar / importar perfil: texto del mockup.
          <span className={mockBadge} title={mockTitle}>
            mockup · sin datos / no cableado
          </span>
        </p>
        <p className={note}>
          Plantilla: <strong>{DEFAULT_TEMPLATE.name}</strong> = {DEFAULT_TEMPLATE.widthMm} x{" "}
          {DEFAULT_TEMPLATE.heightMm} mm. El detalle vive en la seccion Catalogo;{" "}
          <Link href="/editor" className="underline underline-offset-2">
            /editor
          </Link>{" "}
          para la geometria.
        </p>
      </section>

      {/* T7: grilla 2 columnas estilo ZPL Studio (apilada en movil). */}
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
          <Seccion3Catalogo label={settings.label} override={override} onPatchLabel={patchLabel} />

          <Telemetria />
        </div>
      </div>

      {/* Cierre — Guardar es el unico primario; el estado va al final. */}
      <section className={`${cardClear} flex flex-wrap justify-end gap-2 p-5`}>
        <button type="button" onClick={save} className={buttonClear}>
          Guardar
        </button>
      </section>

      <PrintStatus state={state} idleText="" />
    </main>
  );
}
