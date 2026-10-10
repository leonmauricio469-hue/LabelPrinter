"use client";

import { PrinterStatusBanner } from "@/components/printer-status-banner";
import {
  badgeArchivedClear,
  buttonClearSecondary,
  buttonWarn,
  cardClear,
  displayTitle,
  hint,
  input,
  label as labelClass,
} from "@/components/ui";
import type { AppSettings } from "@/lib/settings/settings.types";

/** Insignia honesta para lo estatico: texto del mockup, sin fuente real. */
const mockBadge = `${badgeArchivedClear} ml-2 align-middle`;
const mockTitle =
  "Texto del mockup sin fuente real: no cableado, no son datos en vivo.";

/** Bloque de datos de apoyo: no es un campo, no debe parecerse a uno. */
const note =
  "rounded-md border border-line bg-surface-sunken px-3 py-3 text-xs leading-relaxed text-ink-soft";

/** `input` compartido con la separacion respecto de la etiqueta de arriba. */
const inputClass = `mt-1.5 ${input}`;

const callout = {
  danger:
    "border border-danger-line bg-danger-soft px-3 py-2.5 text-xs leading-relaxed text-danger",
  warn: "border border-warn-line bg-warn-soft px-3 py-2.5 text-xs leading-relaxed text-warn",
} as const;

/**
 * Seccion 1: dispositivo (T2).
 *
 * Cableado real: `transport`, `printerName` / `host` / `port`,
 * `mediaWidthMm` (20-170), banner de estado real, Probar y Test-print.
 * DAEMON IPL y LATENCIA USB son texto del mockup sin fuente: van como
 * UI estatica con insignia honesta, nunca como datos en vivo.
 */
export function Seccion1Dispositivo({
  printer,
  printers,
  refreshKey,
  disenoMm,
  onPatchPrinter,
  onTest,
  onTestPrint,
}: {
  printer: AppSettings["printer"];
  printers: string[];
  refreshKey: number;
  disenoMm: number;
  onPatchPrinter: (patch: Partial<AppSettings["printer"]>) => void;
  onTest: () => void;
  onTestPrint: () => void;
}) {
  const isUsb = printer.transport === "usb";
  const mediaMenorQueDiseno = printer.mediaWidthMm < disenoMm;
  const mediaMayorQueDiseno = printer.mediaWidthMm > disenoMm;

  return (
    <section className={`${cardClear} flex flex-col gap-4 p-5`}>
      <h3 className={`${displayTitle} text-base`}>Dispositivo</h3>

      <PrinterStatusBanner showDetails refreshKey={refreshKey} />

      <div>
        <label htmlFor="transport" className={labelClass}>
          Conexion
        </label>
        <select
          id="transport"
          value={printer.transport}
          onChange={(e) => onPatchPrinter({ transport: e.target.value === "usb" ? "usb" : "tcp" })}
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
          {printers.length > 0 ? (
            <select
              id="printerName"
              value={printer.printerName}
              onChange={(e) => onPatchPrinter({ printerName: e.target.value })}
              className={inputClass}
            >
              {printers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="printerName"
              value={printer.printerName}
              onChange={(e) => onPatchPrinter({ printerName: e.target.value })}
              className={inputClass}
              placeholder="ZDesigner GX420t"
            />
          )}
          <p className={hint}>
            El nombre debe coincidir exactamente con la cola de Windows. Se puede ver en
            PowerShell con <code>Get-Printer</code>. El estado de arriba usa el nombre{" "}
            <strong>guardado</strong>: si se cambia aqui, hay que guardar antes de que cambie.
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
              value={printer.host}
              onChange={(e) => onPatchPrinter({ host: e.target.value })}
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
              step={1}
              value={printer.port}
              onChange={(e) => onPatchPrinter({ port: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
        </div>
      )}

      {/* El ancho del MEDIO, no de la etiqueta: de aqui sale el `^PW`. */}
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
              value={printer.mediaWidthMm}
              onChange={(e) => onPatchPrinter({ mediaWidthMm: Number(e.target.value) })}
              className={`${inputClass} bg-surface`}
            />
          </div>
          <div className="flex-1 text-xs leading-relaxed text-ink-soft">
            <p>
              Lo que mide el <strong>rollo que hay puesto</strong>, no lo que mide la etiqueta.
              Sale de aqui el <code>^PW</code>, que es el ancho de la zona de impresion.
            </p>
            <p className="mt-1.5">
              Si no sabes cuanto mide el rollo, se mide en la impresora antes de imprimir: es el
              unico dato de esta pantalla que no se puede deducir de nada mas.
            </p>
          </div>
        </div>

        {mediaMenorQueDiseno ? (
          <p className={`mt-3 ${callout.danger}`}>
            <strong>No se va a poder imprimir.</strong> Con {printer.mediaWidthMm} mm de rollo y{" "}
            {disenoMm} mm de etiqueta, <code>^PW</code> recorta y no escala: la etiqueta saldria
            cortada por la derecha. La app se niega a imprimir mientras el rollo sea mas estrecho
            que la etiqueta.
          </p>
        ) : mediaMayorQueDiseno ? (
          <p className={`mt-3 ${callout.warn}`}>
            Sale entero, con {((printer.mediaWidthMm - disenoMm) / 2).toFixed(1)} mm de papel de
            mas a cada lado. El diseno va pegado a la izquierda, asi que el sobrante se queda todo
            a la derecha.
          </p>
        ) : null}
      </div>

      {/* Texto del mockup sin fuente real: estatico y etiquetado, nunca en vivo. */}
      <div className={note} title={mockTitle}>
        <p>
          DAEMON IPL
          <span className={mockBadge}>mockup · sin datos / no cableado</span>
        </p>
        <p className="mt-1.5">
          LATENCIA USB
          <span className={mockBadge}>mockup · sin datos / no cableado</span>
        </p>
      </div>

      <p className={hint}>
        La etiqueta de prueba imprime de verdad (texto + lineas) por la conexion de arriba y gasta
        1 etiqueta. No se registra en el historial: es hardware, no una venta.
      </p>

      <div className="flex flex-wrap justify-end gap-2 border-t border-edge pt-4">
        <button type="button" onClick={onTest} className={buttonClearSecondary}>
          Probar conexion
        </button>
        <button type="button" onClick={onTestPrint} className={buttonWarn}>
          Imprimir etiqueta de prueba
        </button>
      </div>
    </section>
  );
}
