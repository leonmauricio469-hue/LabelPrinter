"use client";

import { useCallback, useEffect, useState } from "react";
import { PrintStatus, type PrintState } from "@/components/print-status";
import { PrinterStatusBanner } from "@/components/printer-status-banner";
import type { AppSettings } from "@/lib/settings/settings.types";
import { connectionOkMessage, OTHER_QUEUE, queueChoices, settingsLoadResult } from "./settings.view";

const inputClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none";
const labelClass = "text-sm font-medium text-neutral-700";

/** Configuracion de impresora y etiqueta. Escribe `settings.json`. */
export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  // Error de la carga inicial. Se muestra en lugar del formulario, con un boton de
  // reintento: antes quedaba oculto detras de "Cargando configuracion...". Ver settings.view.ts.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [otherQueue, setOtherQueue] = useState(false);
  const [printers, setPrinters] = useState<string[]>([]);
  const [state, setState] = useState<PrintState>({ kind: "idle" });
  // El estado de la cola se relee despues de guardar (puede haber cambiado el nombre) y
  // despues de la prueba de conexion.
  const [refreshKey, setRefreshKey] = useState(0);

  // El formulario no espera a la lista de impresoras.
  //
  // /api/printers lanza PowerShell para preguntar a Windows por las colas y tarda
  // bastante. Si el formulario dependiera de esa llamada, la pagina se quedaria en
  // "Cargando configuracion" varios segundos aunque /api/settings haya respondido ya.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/settings");
        const body: unknown = await res.json().catch(() => null);
        const load = settingsLoadResult(res.status, body);
        if (load.kind === "error") {
          setLoadError(load.message);
          return;
        }
        setLoadError(null);
        setSettings(load.settings);
      } catch (err) {
        setLoadError(`No se pudo contactar la app: ${(err as Error).message}`);
      }
    })();
  }, [loadAttempt]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/printers");
        const data = (await res.json()) as { printers?: string[]; error?: string };
        setPrinters(data.printers ?? []);
        if (data.error) {
          setState({
            kind: "info",
            message: `No se pudo listar las impresoras: ${data.error}. Escribe el nombre de la cola a mano.`,
          });
        }
      } catch (err) {
        // La lista es una comodidad: si falla se puede seguir escribiendo a mano.
        setPrinters([]);
      }
    })();
  }, []);

  const patchPrinter = useCallback(
    (patch: Partial<AppSettings["printer"]>) => {
      setSettings((prev) => (prev ? { ...prev, printer: { ...prev.printer, ...patch } } : prev));
    },
    [],
  );

  const patchLabel = useCallback((patch: Partial<AppSettings["label"]>) => {
    setSettings((prev) => (prev ? { ...prev, label: { ...prev.label, ...patch } } : prev));
  }, []);

  const save = useCallback(async () => {
    if (!settings || saving) return;
    setSaving(true);
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
      setOtherQueue(false);
      setState({ kind: "ok", message: "Configuracion guardada en settings.json" });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }, [settings, saving]);

  const test = useCallback(async () => {
    if (!settings) return;
    setState({ kind: "busy", message: "Probando conexion..." });
    setRefreshKey((k) => k + 1);
    try {
      const res = await fetch("/api/printer/test", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setState({ kind: "error", message: data.error ?? `Error ${res.status}` });
        return;
      }
      setState({ kind: "ok", message: connectionOkMessage(settings.printer) });
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message });
    }
  }, [settings]);

  if (!settings) {
    if (loadError) {
      return (
        <main className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="max-w-xl text-sm text-red-700">{loadError}</p>
          <button
            type="button"
            onClick={() => setLoadAttempt((n) => n + 1)}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100"
          >
            Reintentar
          </button>
        </main>
      );
    }
    return <p className="py-10 text-center text-neutral-500">Cargando configuracion...</p>;
  }

  const isUsb = settings.printer.transport === "usb";
  const queue = queueChoices(printers, settings.printer.printerName, otherQueue);

  return (
    <main className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Impresora</h2>

        {/* Aqui si se ven las banderas crudas: es la pagina donde se diagnostica, y todavia
            no esta verificado que el driver de la Zebra rellene todas. El numero en crudo es
            lo que hace falta para corregir el mapa si se equivoca. */}
        <PrinterStatusBanner showDetails refreshKey={refreshKey} />

        <div>
          <label htmlFor="transport" className={labelClass}>
            Conexion
          </label>
          <select
            id="transport"
            value={settings.printer.transport}
            onChange={(e) =>
              patchPrinter({ transport: e.target.value === "usb" ? "usb" : "tcp" })
            }
            className={inputClass}
          >
            <option value="usb">USB - cola local de Windows</option>
            <option value="tcp">Red - socket TCP 9100</option>
          </select>
        </div>

        {isUsb ? (
          <div>
            <label htmlFor="printerName" className={labelClass}>
              Cola de impresora
            </label>
            {!queue.manual ? (
              <select
                id="printerName"
                value={settings.printer.printerName}
                onChange={(e) =>
                  e.target.value === OTHER_QUEUE
                    ? setOtherQueue(true)
                    : patchPrinter({ printerName: e.target.value })
                }
                className={inputClass}
              >
                {queue.options.map((name) => (
                  <option key={name} value={name}>
                    {name === OTHER_QUEUE ? "Otra cola (escribir el nombre)..." : name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="printerName"
                value={settings.printer.printerName}
                onChange={(e) => patchPrinter({ printerName: e.target.value })}
                className={inputClass}
                placeholder="ZDesigner GX420t"
              />
            )}
            <p className="mt-1 text-xs text-neutral-500">
              El nombre debe coincidir exactamente con la cola de Windows. Se puede ver
              en PowerShell con <code>Get-Printer</code>. El estado de arriba usa el nombre
              <strong> guardado</strong>: si se cambia aqui, hay que guardar antes de que
              cambie.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="host" className={labelClass}>
                Host
              </label>
              <input
                id="host"
                value={settings.printer.host}
                onChange={(e) => patchPrinter({ host: e.target.value })}
                className={inputClass}
                placeholder="192.168.2.80"
              />
            </div>
            <div>
              <label htmlFor="port" className={labelClass}>
                Puerto
              </label>
              <input
                id="port"
                type="number"
                value={settings.printer.port}
                onChange={(e) => patchPrinter({ port: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={test}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100"
          >
            Probar conexion
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Etiqueta</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="widthMm" className={labelClass}>
              Ancho (mm)
            </label>
            <input
              id="widthMm"
              type="number"
              step="0.5"
              min={30}
              max={104}
              value={settings.label.widthMm}
              onChange={(e) => patchLabel({ widthMm: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="heightMm" className={labelClass}>
              Alto (mm)
            </label>
            <input
              id="heightMm"
              type="number"
              step="0.5"
              min={20}
              max={100}
              value={settings.label.heightMm}
              onChange={(e) => patchLabel({ heightMm: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
        </div>
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
        </div>

        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <strong>Ancho y alto cambian la etiqueta.</strong> La plantilla de 50 x 25 mm se
          adapta a la medida guardada; el codigo de barras mantiene su tamano minimo de
          norma y, si no cabe, la etiqueta sale sin el. Comprueba la medida en papel antes de
          usarla en caja: la medida estandar todavia no esta fijada.
        </p>
      </section>

      <PrintStatus state={state} idleText="" />
    </main>
  );
}
