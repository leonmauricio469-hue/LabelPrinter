"use client";

import { badgeArchivedClear, cardClear, displayTitle } from "@/components/ui";

/** Insignia honesta para lo estatico: texto del mockup, sin fuente real. */
const mockBadge = `${badgeArchivedClear} ml-2 align-middle`;
const mockTitle =
  "Texto del mockup sin fuente real: no cableado, no son datos en vivo.";

/**
 * Telemetria (T4).
 *
 * Sin fuente real: BUFFER, VOLTAJE, RAM y TEMP son texto del mockup. UI
 * estatica con insignia honesta, nunca numeros falsos en vivo.
 */
export function Telemetria() {
  const filas: Array<[string, string]> = [
    ["BUFFER", "mockup"],
    ["VOLTAJE", "mockup"],
    ["RAM", "mockup"],
    ["TEMP 58 °C", "mockup"],
  ];
  return (
    <section className={`${cardClear} flex flex-col gap-4 p-5`}>
      <h3 className={`${displayTitle} text-base`}>Telemetria</h3>
      <dl className="grid grid-cols-2 gap-3 text-xs leading-relaxed text-ink-soft">
        {filas.map(([nombre]) => (
          <div
            key={nombre}
            title={mockTitle}
            className="rounded-md border border-line bg-surface-sunken px-3 py-2.5"
          >
            <dt className="font-medium text-ink">{nombre}</dt>
            <dd className="mt-1">
              <span className={mockBadge}>mockup · sin datos / no cableado</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
