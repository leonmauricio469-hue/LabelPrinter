"use client";

import { badgeArchivedClear, cardClear, displayTitle, pillClear } from "@/components/ui";

/** Insignia honesta para lo estatico: texto del mockup, sin fuente real. */
const mockBadge = `${badgeArchivedClear} ml-2 align-middle`;
const mockTitle =
  "Texto del mockup sin fuente real: no cableado, no son datos en vivo.";

/**
 * Telemetria (T7: replica del template).
 *
 * Sin fuente real: LONGITUD, BUFFER, VOLTAJE, RAM y TEMP son texto del
 * mockup. Todo estatico con UNA insignia honesta para la seccion (no una
 * por tile): ningun numero se presenta como medido en vivo.
 */
export function Telemetria() {
  const tiles: Array<[string, string]> = [
    ["LONGITUD", "14.82 km / Ciclo 42%"],
    ["BUFFER", "0/128KB"],
    ["VOLTAJE", "24.2V"],
    ["RAM", "8.0MB"],
  ];
  return (
    <section className={`${cardClear} flex flex-col gap-4 p-5`} title={mockTitle}>
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden className="inline-block size-2.5 rounded-full bg-success" />
        <h3 className={`${displayTitle} text-base`}>TELEMETRÍA INMEDIATA GX420T</h3>
        <span className={mockBadge}>mockup · sin datos</span>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-xs leading-relaxed text-ink-soft">
        {tiles.map(([nombre, valor]) => (
          <div
            key={nombre}
            className="rounded-md border border-line bg-surface-sunken px-3 py-2.5"
          >
            <dt className="font-medium text-ink">{nombre}</dt>
            <dd className="mt-1 font-mono text-sm text-ink">{valor}</dd>
          </div>
        ))}
      </dl>
      <div className="rounded-md border border-line bg-surface-sunken px-3 py-2.5">
        <p className="font-mono text-xs text-ink">
          Temperatura Sensor Cabezal 58°C (Óptimo &lt; 65°C)
        </p>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-canvas"
          role="img"
          aria-label="Temperatura del mockup: 58 grados de 65 de óptimo (valor estático, no medido)"
          title={mockTitle}
        >
          <div className="h-full w-[89%] rounded-full bg-warn" />
        </div>
      </div>
      <p className={`${pillClear} self-start text-ink-mute`}>
        Valores del mockup: Windows no reporta telemetría del cabezal.
      </p>
    </section>
  );
}
