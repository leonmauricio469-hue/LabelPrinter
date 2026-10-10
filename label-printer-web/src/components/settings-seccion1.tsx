"use client";

import { useEffect, useState } from "react";
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
  pillClear,
} from "@/components/ui";
import type { QueueStatus } from "@/lib/printing/queue.status.types";
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

/** 203 DPI = 8 dots/mm: `MM_TO_DOTS` en `label.template.ts`. */
const DOTS_POR_MM = 8;

/**
 * Seccion 1: dispositivo (T7: replica del template).
 *
 * Textos del template literales; cableado real: `transport` (usb/tcp),
 * `printerName` / `host` / `port`, `mediaWidthMm` (20-170), `oscuridad`
 * (slider, "" = auto), banner de estado real, Detectar (re-fetch de colas),
 * Probar y Test-print. La tercera tarjeta de metodo (Bridge Daemon) es
 * visual: avisa `no cableado` y no se persiste como `transport`.
 * DAEMON/LATENCIA del mockup no viven aca (estan en la sub-barra).
 */
export function Seccion1Dispositivo({
  printer,
  printers,
  refreshKey,
  disenoMm,
  oscuridad,
  onPatchPrinter,
  onPatchRoot,
  onTest,
  onTestPrint,
  onDetectar,
}: {
  printer: AppSettings["printer"];
  printers: string[];
  refreshKey: number;
  disenoMm: number;
  oscuridad: string;
  onPatchPrinter: (patch: Partial<AppSettings["printer"]>) => void;
  onPatchRoot: (patch: { oscuridad: string }) => void;
  onTest: () => void;
  onTestPrint: () => void;
  onDetectar: () => void;
}) {
  const isUsb = printer.transport === "usb";
  const mediaMenorQueDiseno = printer.mediaWidthMm < disenoMm;
  const mediaMayorQueDiseno = printer.mediaWidthMm > disenoMm;

  // Pildora CONECTADO: el MISMO `GET /api/printer/status` del banner, leido
  // para componer el texto del template con datos reales.
  const [spool, setSpool] = useState<QueueStatus | null>(null);
  const [spoolFallo, setSpoolFallo] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/printer/status", {
          cache: "no-store",
          signal: ctrl.signal,
        });
        const j = (await res.json().catch(() => null)) as QueueStatus | null;
        if (ctrl.signal.aborted) return;
        if (!j || typeof j.state !== "string" || typeof j.message !== "string") {
          setSpool(null);
          setSpoolFallo(true);
          return;
        }
        setSpool(j);
        setSpoolFallo(false);
      } catch {
        if (!ctrl.signal.aborted) {
          setSpool(null);
          setSpoolFallo(true);
        }
      }
    })();
    return () => ctrl.abort();
  }, [refreshKey]);

  const spoolLista =
    !spoolFallo && spool?.state === "ready" && (spool?.jobCount ?? 0) === 0;
  const etiquetaSpool =
    spool?.state === "blocked" || spool?.state === "missing" ? "Bloqueada" : "Impresora";
  const colaSpool = spool && spool.jobCount > 0 ? ` (${spool.jobCount} en cola)` : "";

  const colaTexto = isUsb
    ? printer.printerName.trim() !== ""
      ? printer.printerName
      : "sin cola configurada"
    : `${printer.host}:${printer.port}`;

  // Aviso del metodo visual: no toca `transport`, solo se muestra.
  const [avisoPuente, setAvisoPuente] = useState(false);

  // Boton PowerShell: solo despliega la pista de donde sale la lista.
  const [verPS, setVerPS] = useState(false);

  // Slider de densidad: "" (auto) se muestra en 15 pero no se persiste hasta
  // que el operador lo mueve; Auto vuelve a "".
  const nOsc = Number(oscuridad);
  const sliderVal =
    oscuridad === "" || !Number.isFinite(nOsc)
      ? 15
      : Math.min(30, Math.max(0, Math.round(nOsc)));
  const puntos = Number.isFinite(printer.mediaWidthMm)
    ? Math.round(printer.mediaWidthMm * DOTS_POR_MM)
    : 0;

  const tarjetaBase =
    "w-full rounded-card border p-3 text-left transition duration-150";
  const tarjetaActiva = `${tarjetaBase} border-2 border-primary bg-primary-soft`;
  const tarjetaInactiva = `${tarjetaBase} border-edge bg-panel hover:bg-canvas`;

  return (
    <section className={`${cardClear} flex flex-col gap-4 p-5`}>
      <div>
        <h3 className={`${displayTitle} text-base`}>1. DISPOSITIVO E IMPRESORA ZPL</h3>
        <p className={hint}>
          Enlace directo con el controlador de transferencia térmica Zebra
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {spoolLista ? (
          <span
            className={`${pillClear} bg-success-soft text-success`}
            title="Cola lista sin trabajos (GET /api/printer/status)"
          >
            <span aria-hidden className="inline-block size-2 rounded-full bg-success" />
            CONECTADO Y OPERATIVO
          </span>
        ) : spool && !spoolFallo ? (
          <span
            className={`${pillClear} bg-warn-soft text-warn`}
            title="Estado real de la cola (GET /api/printer/status): no esta lista"
          >
            <span aria-hidden className="inline-block size-2 rounded-full bg-warn" />
            {etiquetaSpool}: {spool.message}
            {colaSpool}
          </span>
        ) : (
          <span
            className={pillClear}
            title="No se pudo consultar el estado (GET /api/printer/status)"
          >
            <span aria-hidden className="inline-block size-2 rounded-full bg-ink-mute" />
            Estado: sin datos
          </span>
        )}
        <span
          className={`${pillClear} font-mono`}
          title={
            isUsb
              ? "Cola de Windows (settings printer.printerName)"
              : "Destino de red (settings printer.host/puerto)"
          }
        >
          {colaTexto}
        </span>
      </div>

      <PrinterStatusBanner showDetails refreshKey={refreshKey} />

      <div>
        <p className={labelClass}>MÉTODO DE INTERFAZ / COMUNICACIÓN</p>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            aria-pressed={isUsb}
            onClick={() => onPatchPrinter({ transport: "usb" })}
            className={isUsb ? tarjetaActiva : tarjetaInactiva}
            title="USB: imprime por la cola local de Windows"
          >
            <span className="block text-sm font-bold text-strong">USB - Cola Local Win</span>
            <span className="mt-0.5 block font-mono text-xs text-ink-soft">
              Spooler RAW passthrough
            </span>
            {isUsb && (
              <span className={`${badgeArchivedClear} mt-1.5`}>EN USO</span>
            )}
          </button>
          <button
            type="button"
            aria-pressed={!isUsb}
            onClick={() => onPatchPrinter({ transport: "tcp" })}
            className={!isUsb ? tarjetaActiva : tarjetaInactiva}
            title="Red: socket TCP directo a la impresora (puerto 9100)"
          >
            <span className="block text-sm font-bold text-strong">Red / Ethernet IP</span>
            <span className="mt-0.5 block font-mono text-xs text-ink-soft">
              Puerto 9100 Direct Socket
            </span>
            {!isUsb && (
              <span className={`${badgeArchivedClear} mt-1.5`}>EN USO</span>
            )}
          </button>
          <button
            type="button"
            aria-pressed={false}
            onClick={() => setAvisoPuente(true)}
            className={tarjetaInactiva}
            title="Sin fuente real: este servicio no esta cableado en la app."
          >
            <span className="block text-sm font-bold text-strong">
              Zebra Bridge Daemon
            </span>
            <span className="mt-0.5 block text-xs text-ink-soft">
              Servicio local WebSocket
            </span>
            <span className={mockBadge} title={mockTitle}>
              no cableado
            </span>
          </button>
        </div>
        {avisoPuente && (
          <div className={`mt-2 ${callout.warn}`} role="status">
            <p>
              <strong>Zebra Bridge Daemon no está cableado:</strong> no se guardó
              nada y el transporte sigue siendo {isUsb ? "USB" : "RED TCP"}.
            </p>
            <button
              type="button"
              onClick={() => setAvisoPuente(false)}
              className={`${buttonClearSecondary} mt-2 px-3 py-1.5 text-xs`}
            >
              Entendido
            </button>
          </div>
        )}
      </div>

      {isUsb ? (
        <div>
          <label htmlFor="printerName" className={labelClass}>
            COLA DE IMPRESIÓN WINDOWS DETECTADA
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
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onDetectar}
              className={`${buttonClearSecondary} px-3 py-1.5 text-xs`}
              title="Vuelve a pedir la lista de colas (GET /api/printers)"
            >
              Detectar
            </button>
            <button
              type="button"
              aria-expanded={verPS}
              onClick={() => setVerPS((v) => !v)}
              className={`${buttonClearSecondary} px-3 py-1.5 text-xs`}
              title="Muestra de donde sale la lista de colas"
            >
              PowerShell
            </button>
          </div>
          {verPS && (
            <p className={hint}>
              La lista sale de Windows con <code>Get-Printer</code>. El nombre
              elegido tiene que coincidir exactamente con la cola.
            </p>
          )}
          <p className={note} title={mockTitle}>
            Controlador Zebra Designer v5.1
            <span className={mockBadge}>mockup · sin datos / no cableado</span>
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

      <div className={`${cardClear} flex flex-col gap-3 border border-edge p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className={`${displayTitle} text-sm`}>
            CALIBRACIÓN FÍSICA DE CABEZAL Y ROLLO PAPICAR
          </h4>
          <span className="font-mono text-[11px] text-ink-mute">
            DPI_GEOMETRY_CONFIG
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-edge bg-canvas p-3">
            <label htmlFor="mediaWidthMm" className={labelClass}>
              ANCHO ROLLO FÍSICO
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
            <p className="mt-1.5 font-mono text-[11px] text-ink-soft">
              {puntos} puntos a 203 DPI
            </p>
          </div>
          <div
            className="rounded-md border border-edge bg-canvas p-3"
            title={mockTitle}
          >
            <p className={labelClass}>RESOLUCIÓN CABEZAL</p>
            <div className="mt-2.5 flex gap-2">
              <span className={`${pillClear} bg-primary-soft font-mono text-primary`}>
                203 DPI
              </span>
              <span className={`${pillClear} font-mono text-ink-mute`}>300 DPI</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
              El builder calcula a 203 (8 dots/mm).
              <span className={mockBadge}>mockup · sin datos</span>
            </p>
          </div>
          <div className="rounded-md border border-edge bg-canvas p-3">
            <label htmlFor="oscuridad" className={labelClass}>
              DENSIDAD TÉRMICA {oscuridad === "" ? "(auto)" : `(${oscuridad} / 30)`}
            </label>
            <input
              id="oscuridad"
              type="range"
              min={0}
              max={30}
              step={1}
              value={sliderVal}
              onChange={(e) => onPatchRoot({ oscuridad: e.target.value })}
              className="mt-2.5 h-2 w-full accent-primary"
            />
            <div className="mt-1 flex items-center justify-between text-[11px] text-ink-mute">
              <span>(Claro)</span>
              <button
                type="button"
                onClick={() => onPatchRoot({ oscuridad: "" })}
                disabled={oscuridad === ""}
                className={`${buttonClearSecondary} px-2.5 py-1 text-[11px]`}
                title="Vacío = automático: la impresora usa su ajuste físico"
              >
                Auto
              </button>
              <span>(Quemado)</span>
            </div>
            <p className={hint}>
              {oscuridad === ""
                ? "Auto: no se antepone nada al ZPL, manda el ajuste físico."
                : "Con valor se antepone `~SD` al ZPL."}
            </p>
          </div>
          <div
            className="rounded-md border border-edge bg-canvas p-3"
            title={mockTitle}
          >
            <p className={labelClass}>SENSOR DE ESPACIO</p>
            <p className="mt-2 text-sm font-medium text-ink">
              Web / Gap (Troquel)
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
              Separación fija: 3.0mm
              <span className={mockBadge}>mockup · sin datos</span>
            </p>
          </div>
        </div>

        {mediaMenorQueDiseno ? (
          <p className={callout.danger}>
            <strong>No se va a poder imprimir.</strong> Con {printer.mediaWidthMm} mm
            de rollo y {disenoMm} mm de etiqueta, el ancho recorta y no escala: la
            etiqueta saldría cortada por la derecha.
          </p>
        ) : mediaMayorQueDiseno ? (
          <p className={callout.warn}>
            Sale entero, con {((printer.mediaWidthMm - disenoMm) / 2).toFixed(1)} mm
            de papel de más a cada lado. El diseño va pegado a la izquierda, así que
            el sobrante se queda todo a la derecha.
          </p>
        ) : null}
      </div>

      <p className={hint}>
        La etiqueta de prueba imprime de verdad (texto + líneas) por la conexión de
        arriba y gasta 1 etiqueta. No se registra en el historial: es hardware, no
        una venta.
      </p>

      <div className="flex flex-wrap justify-end gap-2 border-t border-edge pt-4">
        <button type="button" onClick={onTest} className={buttonClearSecondary}>
          Probar Conexión (Ping RAW)
        </button>
        <button type="button" onClick={onTestPrint} className={buttonWarn}>
          Imprimir Etiqueta de Prueba Física
        </button>
      </div>
    </section>
  );
}
