"use client";

import {
  badgeArchivedClear,
  buttonClearSecondary,
  cardClear,
  displayTitle,
  hint,
  input,
  label as labelClass,
} from "@/components/ui";
import { beepOk } from "@/lib/sonido";
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
    "sonidoOk" | "sonidoError" | "ventanaDuplicadosMs" | "retardoEscanerMs"
  >
>;

/**
 * Seccion 2: comportamiento (T7: replica del template).
 *
 * Las dos tarjetas son texto del template con interruptores estaticos en ON
 * (sin campo en settings: el flujo siempre imprime igual y el builder
 * siempre pliega a ASCII+mayusculas). El pie de la primera es vivo
 * (`retardoEscanerMs` / `ventanaDuplicadosMs` reales); el de la segunda
 * describe el mecanismo real: el builder NO emite `^CI`, pliega el texto
 * antes de imprimir (`foldAscii` en `ascii.fold.ts`).
 * Los tiempos y los sonidos siguen cableados abajo: la tarjeta `Feedback
 * Sonoro del Terminal` (`Beep Éxito` / `Alarma Error` = `sonidoOk` /
 * `sonidoError`) con `Test Sonido` que emite el beep real (`beepOk` de
 * `sonido.ts`, sin duplicar lógica).
 */
export function Seccion2Comportamiento({
  sonidoOk,
  sonidoError,
  ventanaDuplicadosMs,
  retardoEscanerMs,
  onPatch,
}: {
  sonidoOk: boolean;
  sonidoError: boolean;
  ventanaDuplicadosMs: number;
  retardoEscanerMs: number;
  onPatch: (patch: RootPatch) => void;
}) {
  return (
    <section className={`${cardClear} flex flex-col gap-4 p-5`}>
      <div>
        <h3 className={`${displayTitle} text-base`}>
          2. COMPORTAMIENTO Y FLUJO DE TRABAJO
        </h3>
        <p className={hint}>
          Automatización de lectura por pistola láser/escáner y sanitización de caracteres
        </p>
      </div>

      <div className={note} title={mockTitle}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">
            Auto-imprimir al Escanear [MODO RÁPIDO]
          </p>
          <input
            type="checkbox"
            disabled
            checked
            aria-label="Auto-imprimir al escanear (mockup, siempre activo)"
            title="Sin fuente real: auto-imprimir no tiene campo en settings."
            className="size-4 shrink-0 accent-primary"
          />
        </div>
        <p className="mt-1.5">
          Interruptor del mockup, siempre activo y sin campo en settings: no cambia
          el flujo real, la etiqueta sale por IMPRIMIR AHORA o el modo rápido.
          <span className={mockBadge}>mockup · sin datos / no cableado</span>
        </p>
        <p className="mt-2 border-t border-line pt-2 font-mono text-[11px] text-ink-soft">
          Retardo: {retardoEscanerMs}ms · Rechazo duplicados:{" "}
          {ventanaDuplicadosMs > 0 ? "Activo" : "Inactivo"}
        </p>
      </div>

      <div className={note} title={mockTitle}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">
            Conversión Forzada ASCII &amp; Mayúsculas
          </p>
          <input
            type="checkbox"
            disabled
            checked
            aria-label="Conversión ASCII y mayúsculas (mockup, siempre activa)"
            title="Sin fuente real: no tiene campo en settings porque el builder lo hace siempre."
            className="size-4 shrink-0 accent-primary"
          />
        </div>
        <p className="mt-1.5">
          Interruptor del mockup, siempre activo y sin campo en settings: el builder
          pliega todo el texto a ASCII y mayúsculas antes de imprimir.
          <span className={mockBadge}>mockup · sin datos / no cableado</span>
        </p>
        <p className="mt-2 border-t border-line pt-2 font-mono text-[11px] text-ink-soft">
          Plegado ASCII + MAYÚSCULAS activo · el builder no emite ^CI
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
            0 = apagada. Con valor mayor que 0, repetir el mismo codigo dentro de la
            ventana no imprime: avisa duplicado ignorado.
          </p>
        </div>
      </div>

      <div className={note}>
        <p className="text-sm font-semibold text-ink">Feedback Sonoro del Terminal</p>
        <p className="mt-1">
          Señales acústicas sintetizadas para confirmación de escaneo válido y aviso de
          atasco o falta de papel.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-ink">
            <input
              type="checkbox"
              checked={sonidoOk}
              onChange={(e) => onPatch({ sonidoOk: e.target.checked })}
              className="size-4 accent-primary"
            />
            Beep Éxito
          </label>
          <label className="flex items-center gap-1.5 text-xs font-medium text-ink">
            <input
              type="checkbox"
              checked={sonidoError}
              onChange={(e) => onPatch({ sonidoError: e.target.checked })}
              className="size-4 accent-primary"
            />
            Alarma Error
          </label>
          <button
            type="button"
            onClick={() => beepOk()}
            className={`${buttonClearSecondary} px-2.5 py-1.5 text-xs`}
            title="Emite el beep real de éxito (WebAudio, src/lib/sonido.ts)"
          >
            Test Sonido
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-mute">
          Cableados a `sonidoOk` / `sonidoError` de settings; el test suena igual que al
          imprimir bien.
        </p>
      </div>
    </section>
  );
}
