"use client";

import type { Dispatch, SetStateAction } from "react";
import { MAX_QTY_POR_TRABAJO } from "@/lib/validation/schemas";

/**
 * Minimo y maximo por [[Cantidad de Etiquetas]].
 *
 * El maximo no es 999, es 6, y el motivo es `usb.transport.ts`: manda el ZPL entero como un
 * argumento de linea de comandos en base64, y Windows corta `CreateProcessW` en 32767
 * caracteres. Con el nombre mas largo del catalogo real, una etiqueta son 3629 bytes de ZPL
 * (4840 en base64) y a partir de la septima ya no entra. Con el tope en 999, pedir 7
 * devolvia un 500 sin imprimir y sin dejar registro en el historial.
 *
 * El mismo numero esta en `MAX_QTY_POR_TRABAJO` y lo comparte el esquema del servidor, de
 * modo que el boton y el 400 cuentan la misma historia.
 *
 * Subirlo es cambiar COMO se pasa el ZPL a `send-raw.ps1` (archivo temporal o stdin), no este
 * numero.
 */
const MIN_QTY = 1;
const MAX_QTY = MAX_QTY_POR_TRABAJO;

/**
 * Campo numerico con flechas +/-. Permite escribir el numero directamente.
 *
 * `onChange` acepta un updater, igual que el setter de `useState`. Calcular el valor
 * siguiente desde la prop en vez de desde el updater hace que dos clics rapidos usen el
 * mismo valor viejo y el stepper se quede uno corto (1 -> 1 -> 2 en vez de 1 -> 2 -> 3).
 */
export function QuantityStepper({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: Dispatch<SetStateAction<number>>;
  disabled?: boolean;
}) {
  const clamp = (n: number) => Math.min(MAX_QTY, Math.max(MIN_QTY, n));
  const step = (delta: number) => onChange((prev) => clamp(prev + delta));

  /**
   * Clases del contador.
   *
   * Los tres controles miden lo mismo (48px) y comparten borde: es una sola pieza, no
   * tres botones sueltos. El `tabular-nums` en el input es para que al pasar de 1 a 2 el
   * ancho del numero no salte y el grupo no se ensanche una pila de pixels a la derecha.
   */
  const face =
    "h-12 rounded-md border border-line-strong bg-surface text-ink transition duration-150";
  const buttonClass = `${face} w-12 text-xl font-medium hover:bg-surface-sunken active:bg-line disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-surface`;

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Quitar una etiqueta"
        onClick={() => step(-1)}
        disabled={disabled || value <= MIN_QTY}
        className={buttonClass}
      >
        &minus;
      </button>

      <input
        type="number"
        inputMode="numeric"
        aria-label="Cantidad de etiquetas"
        value={value}
        min={MIN_QTY}
        max={MAX_QTY}
        disabled={disabled}
        onChange={(e) => {
          const parsed = Number.parseInt(e.target.value, 10);
          // Campo vacio o basura -> vuelve al minimo en vez de NaN.
          onChange(Number.isFinite(parsed) ? clamp(parsed) : MIN_QTY);
        }}
        className={`${face} w-24 text-center text-2xl font-bold tabular-nums disabled:bg-surface-sunken`}
      />

      <button
        type="button"
        aria-label="Agregar una etiqueta"
        onClick={() => step(1)}
        disabled={disabled || value >= MAX_QTY}
        className={buttonClass}
      >
        +
      </button>

      {/* El tope no se esconde: sin esto, el operador que lleva 6 y pulsa `+` no sabe si
          la app se colgo o si ya no puede mas. Es el unico texto que agrega el stepper. */}
      {value >= MAX_QTY && !disabled && (
        <span className="ml-1 text-xs font-medium text-warn">max.</span>
      )}
    </div>
  );
}
