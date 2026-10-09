"use client";

import { useCallback, useEffect, useState } from "react";
import { PrintStatus, type PrintState } from "@/components/print-status";
import { PrinterStatusBanner } from "@/components/printer-status-banner";
import {
  buttonClear,
  buttonClearSecondary,
  buttonWarn,
  cardClear,
  displayTitle,
  hint,
  input,
  label as labelClass,
  pillClear,
} from "@/components/ui";
import type { AppSettings } from "@/lib/settings/settings.types";
import { DEFAULT_TEMPLATE, TEMPLATES } from "@/lib/labels/label.template";

/**
 * Cajones de aviso dentro de la configuracion.
 *
 * Son tres y no uno porque el peso del mensaje no es el mismo: `danger` dice "no se va a
 * poder imprimir", `warn` dice "sale, pero miralo", e `info` es documentacion que conviene
 * tener a mano mientras se rellena el campo. Pintar los tres del mismo ambar obligaria al
 * operador a leerlos todos para saber cual le impide trabajar.
 */
const callout = {
  danger: "border border-danger-line bg-danger-soft px-3 py-2.5 text-xs leading-relaxed text-danger",
  warn: "border border-warn-line bg-warn-soft px-3 py-2.5 text-xs leading-relaxed text-warn",
  info: "border border-line bg-surface-sunken px-3 py-2.5 text-xs leading-relaxed text-ink-soft",
} as const;

/** Bloque de datos de apoyo: no es un campo, no debe parecerse a uno. */
const note = "rounded-md border border-line bg-surface-sunken px-3 py-3 text-xs leading-relaxed text-ink-soft";

/** `input` compartido con el separacion respecto de la etiqueta de arriba. */
const inputClass = `mt-1.5 ${input}`;

/** Dispositivos (F3): la GX420 y su etiqueta, sobre la piel ClearCraft. Escribe `settings.json`. */
export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [printers, setPrinters] = useState<string[]>([]);
  const [state, setState] = useState<PrintState>({ kind: "idle" });
  // El estado de la cola se relee despues de guardar (puede haber cambiado el nombre) y
  // despues de cada prueba.
  const [refreshKey, setRefreshKey] = useState(0);
  // Si `/editor` ha guardado una geometria, esta pagina es el unico sitio donde el operador
  // se entera antes de imprimir. Sin este aviso, alguien que nunca abra el editor imprimiria
  // con unos numeros distintos de los del codigo sin saberlo.
  const [override, setOverride] = useState<{ activo: boolean; savedAt?: string } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/editor/apply");
        if (!res.ok) return;
        const j = await res.json();
        setOverride({ activo: Boolean(j.activo), savedAt: j.savedAt ?? undefined });
      } catch {
        // Si no se puede leer, no se avisa. Es informacion secundaria: lo grave seria que la
        // impresion fallara por esto, y no falla, `readOverride()` cae a la plantilla del codigo.
      }
    })();
  }, [refreshKey]);

  // El formulario no espera a la lista de impresoras.
  //
  // /api/printers lanza PowerShell para preguntar a Windows por las colas y tarda
  // bastante. Si el formulario dependiera de esa llamada, la pagina se quedaria en
  // "Cargando configuracion" varios segundos aunque /api/settings haya respondido ya.
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
      } catch {
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
    if (!settings) return;
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

  // Etiqueta de diagnostico: imprime DE VERDAD (texto + barras) por el transporte
  // configurado. Gasta 1 etiqueta y no se registra en el historial: es hardware,
  // no una venta. Por eso pide confirmacion antes.
  const testPrint = useCallback(async () => {
    if (!window.confirm("La etiqueta de prueba se imprime de verdad y gasta 1 etiqueta. ¿Imprimirla?")) {
      return;
    }
    setState({ kind: "busy", message: "Imprimiendo etiqueta de prueba..." });
    try {
      const res = await fetch("/api/printer/test-print", { method: "POST" });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        destino?: string;
      };
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

  const isUsb = settings.printer.transport === "usb";
  const queueOptions =
    printers.includes(settings.printer.printerName)
      ? printers
      : [...printers, settings.printer.printerName];

  // El rollo frente a la etiqueta. El segundo caso es el que se niega a imprimir.
  const mediaMenorQueDiseno = settings.printer.mediaWidthMm < DEFAULT_TEMPLATE.widthMm;
  const mediaMayorQueDiseno = settings.printer.mediaWidthMm > DEFAULT_TEMPLATE.widthMm;

  // `TEMPLATES.find` puede no encontrar: un `settings.json` de antes de v1.3 sigue teniendo
  // `papicar-50x25`, que ya no existe en el codigo. La impresora usa `templateById()`, que cae
  // en la de 59 mm; aqui solo se avisa, que es lo que puede hacer una pagina.
  const plantillaActiva = TEMPLATES.find((t) => t.id === settings.label.templateId);
  // Con una sola plantilla no hace falta el selector, pero el aviso del medio NO es opcional:
  // es la unica vez que el operador ve, en la pagina que va a leer antes de imprimir, que el
  // rollo tiene que estar cambiado en la impresora.
  const idObsoleto = plantillaActiva ? null : settings.label.templateId;

  return (
    <main className="flex flex-col gap-5">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={`${displayTitle} text-lg`}>Dispositivos</h2>
        {/* Una sola impresora en toda la pantalla: la GX420 (decision de alcance) y el
            transporte que tiene configurado ahora mismo, que sale de settings, no se inventa. */}
        <span className={`${pillClear} bg-primary-soft text-primary`}>
          GX420 · {isUsb ? "USB" : "Red"}
        </span>
      </section>

      <section className={`${cardClear} flex flex-col gap-4 p-5`}>
        <h3 className={`${displayTitle} text-base`}>Impresora</h3>

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
            {queueOptions.length > 0 ? (
              <select
                id="printerName"
                value={settings.printer.printerName}
                onChange={(e) => patchPrinter({ printerName: e.target.value })}
                className={inputClass}
              >
                {queueOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
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
            <p className={hint}>
              El nombre debe coincidir exactamente con la cola de Windows. Se puede ver en
              PowerShell con <code>Get-Printer</code>. El estado de arriba usa el nombre{" "}
              <strong>guardado</strong>: si se cambia aqui, hay que guardar antes de que
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

        {/* El ancho del MEDIO, que no es el ancho de la etiqueta.
            Va aqui y no en la seccion de "Etiqueta" porque es una medida de la impresora: lo
            pone la persona, en la impresora, y de aqui solo sale el `^PW` que le dice a la
            impresora cuanto papel hay. */}
        <div className={note}>
          <div className="flex items-end gap-4">
            <div className="w-40 shrink-0">
              <label htmlFor="mediaWidthMm" className={labelClass}>
                Ancho del rollo (mm)
              </label>
              <input
                id="mediaWidthMm"
                type="number"
                step={0.5}
                min={20}
                max={170}
                value={settings.printer.mediaWidthMm}
                onChange={(e) => patchPrinter({ mediaWidthMm: Number(e.target.value) })}
                className={`${inputClass} bg-surface`}
              />
            </div>
            <div className="flex-1 text-xs leading-relaxed text-ink-soft">
              <p>
                Lo que mide el <strong>rollo que hay puesto</strong>, no lo que mide la
                etiqueta. Sale de aqui el <code>^PW</code>, que es el ancho de la zona de
                impresion.
              </p>
              <p className="mt-1.5">
                No es el ancho de la etiqueta, que son {DEFAULT_TEMPLATE.widthMm} mm, ni lo que
                pone <code>settings.json</code> en sus campos de ancho. Si no sabes cuanto mide
                el rollo, se mide en la impresora (el panel, o el menu de medios) antes de
                imprimir: es el unico dato de esta pantalla que no se puede deducir de nada
                mas.
              </p>
            </div>
          </div>

          {mediaMenorQueDiseno ? (
            <p className={`mt-3 ${callout.danger}`}>
              <strong>No se va a poder imprimir.</strong> Con {settings.printer.mediaWidthMm} mm
              de rollo y {DEFAULT_TEMPLATE.widthMm} mm de etiqueta, <code>^PW</code> recorta y
              no escala: la etiqueta saldria cortada por la derecha, con el ZPL perfectamente
              valido y sin que la impresora diga nada. La app se niega a imprimir mientras el
              rollo sea mas estrecho que la etiqueta.
            </p>
          ) : mediaMayorQueDiseno ? (
            <p className={`mt-3 ${callout.warn}`}>
              Sale entero, con{" "}
              {((settings.printer.mediaWidthMm - DEFAULT_TEMPLATE.widthMm) / 2).toFixed(1)} mm
              de papel de mas a cada lado. El diseno va pegado a la izquierda, asi que el
              sobrante se queda todo a la derecha. Si al verlo sale descuadrado, se ajusta el
              margen en la impresora, no en el ZPL.
            </p>
          ) : null}
        </div>

        <p className={hint}>
          La etiqueta de prueba imprime de verdad (texto + lineas) por la conexion de arriba y
          gasta 1 etiqueta. No se registra en el historial: es hardware, no una venta.
        </p>

        {/*
          Guardar va al final y es el unico primario de la pantalla. Antes estaba pegado a
          "Probar conexion" con el mismo peso visual, y las dos acciones no son equivalentes:
          una escribe en disco y la otra solo consulta. Un operador que quiere salvar una
          configuracion valida tenia que elegir entre dos botones del mismo tamano.
        */}
        <div className="flex flex-wrap justify-end gap-2 border-t border-edge pt-4">
          <button type="button" onClick={test} className={buttonClearSecondary}>
            Probar conexion
          </button>
          <button type="button" onClick={testPrint} className={buttonWarn}>
            Imprimir etiqueta de prueba
          </button>
          <button type="button" onClick={save} className={buttonClear}>
            Guardar
          </button>
        </div>
      </section>

      <section className={`${cardClear} flex flex-col gap-4 p-5`}>
        <h3 className={`${displayTitle} text-base`}>Etiqueta</h3>

        <div className={note}>
          <p>
            Plantilla: <strong>{DEFAULT_TEMPLATE.name}</strong> ={" "}
            {DEFAULT_TEMPLATE.widthMm} x {DEFAULT_TEMPLATE.heightMm} mm ={" "}
            {DEFAULT_TEMPLATE.widthDots} x {DEFAULT_TEMPLATE.heightDots} dots a 203 dpi.
          </p>
          {idObsoleto && (
            <p className="mt-1.5">
              Guardada la <code>{idObsoleto}</code>, que ya no existe en el codigo. Se va a
              imprimir con la de 59 x 35 mm de todos modos. Pulsa Guardar para dejar el{" "}
              <code>settings.json</code> limpio.
            </p>
          )}
          <p className="mt-1.5">
            Los campos de ancho y alto de abajo ya no mandan: la medida sale de la plantilla. Se
            conservan para no romper el <code>settings.json</code> guardado.
          </p>
          {override?.activo && (
            <p className={`mt-3 ${callout.warn}`}>
              <strong>Se esta imprimiendo con una geometria guardada desde el editor</strong> (
              {override.savedAt}), no con los numeros del codigo. Se guarda en{" "}
              <code>data/plantilla-override.json</code>. En{" "}
              <a href="/editor" className="underline underline-offset-2">
                /editor
              </a>{" "}
              hay un boton para descartarla y volver a la del codigo.
            </p>
          )}
        </div>

        <p className={callout.warn}>
          <strong>El rollo hay que cambiarlo en la impresora, no aqui.</strong> El ancho del
          rollo de arriba sale del <code>^PW</code>, pero el medio de verdad lo pone la
          impresora. Si el <code>^PW</code> no coincide con el rollo, lo que hace{" "}
          <code>^PW</code> es <strong>recortar</strong>: no escala, no centra y no avisa. Con el
          rollo de 50 mm y la etiqueta de {DEFAULT_TEMPLATE.widthMm} mm, la etiqueta saldria
          cortada por la derecha sin que nada proteste.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="widthMm" className={labelClass}>
              Ancho (mm)
            </label>
            <input
              id="widthMm"
              type="number"
              step="0.5"
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
          <p className={hint}>
            Aparece impresa en la etiqueta. Cambiarla aqui no reimprime nada: toma efecto en la
            proxima tirada.
          </p>
        </div>
      </section>

      <PrintStatus state={state} idleText="" />
    </main>
  );
}
