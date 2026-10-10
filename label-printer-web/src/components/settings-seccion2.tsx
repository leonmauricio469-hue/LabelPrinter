"use client";

import { useState } from "react";
import {
  buttonClearSecondary,
  cardClear,
  displayTitle,
  hint,
  input,
  label as labelClass,
} from "@/components/ui";
import { beepError, beepOk } from "@/lib/sonido";
import type { AppSettings } from "@/lib/settings/settings.types";

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
 * Seccion 2: comportamiento.
 *
 * El flujo siempre imprime igual (IMPRIMIR AHORA o modo rapido al escanear)
 * y el builder siempre pliega el texto a ASCII y mayusculas antes de
 * imprimir: son comportamiento fijo, no ajustes, asi que se describen en
 * dos notas compactas en vez de interruptores. El pie de la primera muestra
 * los tiempos reales (`retardoEscanerMs` / `ventanaDuplicadosMs`).
 * Los tiempos y los sonidos siguen cableados abajo: la tarjeta `Feedback
 * Sonoro del Terminal` (`Beep Éxito` / `Alarma Error` = `sonidoOk` /
 * `sonidoError`) con `Test Sonido` que emite el beep real (`beepOk` de
 * `sonido.ts`, sin duplicar lógica) y `Probar alarma` que emite la alarma
 * real de error (`beepError` del mismo lib).
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
  // La alarma es WebAudio local: nunca trae red ni papel, el fallo honesto es
  // no oir nada (volumen o auricular) y eso se dice en el mensaje.
  const [prueba, setPrueba] = useState<string | null>(null);

  const probarAlarma = () => {
    try {
      beepError();
      setPrueba("Alarma emitida: si no se oye, revisar volumen o auricular.");
    } catch (err) {
      setPrueba(`No se pudo emitir la alarma: ${(err as Error).message}.`);
    }
  };

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

      <div className={note}>
        <p className="text-sm font-semibold text-ink">
          Impresión al escanear: siempre activa
        </p>
        <p className="mt-1.5">
          Cada código leído sale por IMPRIMIR AHORA o por el modo rápido. No se
          puede apagar: es el flujo de trabajo, no un ajuste.
        </p>
        <p className="mt-2 border-t border-line pt-2 font-mono text-[11px] text-ink-soft">
          Retardo: {retardoEscanerMs}ms · Rechazo duplicados:{" "}
          {ventanaDuplicadosMs > 0 ? "Activo" : "Inactivo"}
        </p>
      </div>

      <div className={note}>
        <p className="text-sm font-semibold text-ink">
          Texto en ASCII y mayúsculas: siempre aplicado
        </p>
        <p className="mt-1.5">
          El builder pliega todo el texto antes de imprimir. No se puede
          apagar: la impresora solo entiende ese juego de caracteres.
        </p>
        <p className="mt-2 border-t border-line pt-2 font-mono text-[11px] text-ink-soft">
          Plegado ASCII + MAYÚSCULAS activo
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
          <button
            type="button"
            onClick={probarAlarma}
            className={`${buttonClearSecondary} px-2.5 py-1.5 text-xs`}
            title="Emite la alarma real de error (WebAudio, src/lib/sonido.ts)"
          >
            Probar alarma
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-mute">
          Cableados a `sonidoOk` / `sonidoError` de settings; cada prueba suena
          igual que su señal real al imprimir.
        </p>
        {prueba && <p className="mt-1.5 text-xs text-ink">{prueba}</p>}
      </div>
    </section>
  );
}
