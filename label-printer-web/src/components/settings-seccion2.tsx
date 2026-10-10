"use client";

import {
  badgeArchivedClear,
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

type RootPatch = Partial<
  Pick<
    AppSettings,
    "oscuridad" | "sonidoOk" | "sonidoError" | "ventanaDuplicadosMs" | "retardoEscanerMs"
  >
>;

/**
 * Seccion 2: comportamiento (T3).
 *
 * Cableado real: `oscuridad` ("~SD", "" = auto), `retardoEscanerMs`
 * (100-5000), `ventanaDuplicadosMs` (0-60000), `sonidoOk` / `sonidoError`.
 * Auto-imprimir y Conversion ASCII son texto del mockup sin fuente: van
 * como toggles deshabilitados con `title` honesto.
 */
export function Seccion2Comportamiento({
  oscuridad,
  sonidoOk,
  sonidoError,
  ventanaDuplicadosMs,
  retardoEscanerMs,
  onPatch,
}: {
  oscuridad: string;
  sonidoOk: boolean;
  sonidoError: boolean;
  ventanaDuplicadosMs: number;
  retardoEscanerMs: number;
  onPatch: (patch: RootPatch) => void;
}) {
  return (
    <section className={`${cardClear} flex flex-col gap-4 p-5`}>
      <h3 className={`${displayTitle} text-base`}>Comportamiento</h3>

      <div>
        <label htmlFor="oscuridad" className={labelClass}>
          Oscuridad (~SD)
        </label>
        <input
          id="oscuridad"
          value={oscuridad}
          onChange={(e) => onPatch({ oscuridad: e.target.value })}
          className={inputClass}
          placeholder="auto"
        />
        <p className={hint}>
          Vacio = automatico: no se antepone nada al ZPL y la impresora usa su ajuste fisico. Si
          se informa, entero de 0 a 30.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="retardoEscanerMs" className={labelClass}>
            Retardo del escaner (ms)
          </label>
          <input
            id="retardoEscanerMs"
            type="number"
            step={1}
            min={100}
            max={5000}
            value={retardoEscanerMs}
            onChange={(e) => onPatch({ retardoEscanerMs: Number(e.target.value) })}
            className={inputClass}
          />
          <p className={hint}>Ventana idle del escaner USB. Entero de 100 a 5000.</p>
        </div>
        <div>
          <label htmlFor="ventanaDuplicadosMs" className={labelClass}>
            Ventana de duplicados (ms)
          </label>
          <input
            id="ventanaDuplicadosMs"
            type="number"
            step={1}
            min={0}
            max={60000}
            value={ventanaDuplicadosMs}
            onChange={(e) => onPatch({ ventanaDuplicadosMs: Number(e.target.value) })}
            className={inputClass}
          />
          <p className={hint}>
            0 = apagada. Con valor mayor que 0, repetir el mismo codigo dentro de la ventana no
            imprime: avisa duplicado ignorado.
          </p>
        </div>
      </div>

      <div className={note}>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={sonidoOk}
            onChange={(e) => onPatch({ sonidoOk: e.target.checked })}
            className="size-4 accent-primary"
          />
          Sonido al imprimir bien
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={sonidoError}
            onChange={(e) => onPatch({ sonidoError: e.target.checked })}
            className="size-4 accent-primary"
          />
          Sonido al fallar
        </label>
        <p className="mt-2 text-xs text-ink-mute">Beeps WebAudio del operador.</p>
      </div>

      {/* Texto del mockup sin fuente real: deshabilitado y etiquetado. */}
      <div className={note} title={mockTitle}>
        <label className="flex items-center gap-2 text-sm text-ink-mute">
          <input
            type="checkbox"
            disabled
            checked={false}
            title="Sin fuente real: auto-imprimir no esta cableado."
            className="size-4"
          />
          Auto-imprimir
          <span className={mockBadge}>mockup · sin datos / no cableado</span>
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm text-ink-mute">
          <input
            type="checkbox"
            disabled
            checked={false}
            title="Sin fuente real: conversion ASCII no esta cableada."
            className="size-4"
          />
          Conversion ASCII
          <span className={mockBadge}>mockup · sin datos / no cableado</span>
        </label>
      </div>
    </section>
  );
}
