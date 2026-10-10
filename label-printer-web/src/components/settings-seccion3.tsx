"use client";

import Link from "next/link";
import {
  badgeArchivedClear,
  cardClear,
  displayTitle,
  hint,
  input,
  label as labelClass,
} from "@/components/ui";
import type { AppSettings } from "@/lib/settings/settings.types";
import { DEFAULT_TEMPLATE, TEMPLATES } from "@/lib/labels/label.template";

/** Insignia honesta para lo estatico: texto del mockup, sin fuente real. */
const mockBadge = `${badgeArchivedClear} ml-2 align-middle`;
const mockTitle =
  "Texto del mockup sin fuente real: no cableado, no son datos en vivo.";

/** Bloque de datos de apoyo: no es un campo, no debe parecerse a uno. */
const note =
  "rounded-md border border-line bg-surface-sunken px-3 py-3 text-xs leading-relaxed text-ink-soft";

/** `input` compartido con la separacion respecto de la etiqueta de arriba. */
const inputClass = `mt-1.5 ${input}`;

const calloutWarn =
  "border border-warn-line bg-warn-soft px-3 py-2.5 text-xs leading-relaxed text-warn";

/**
 * Seccion 3: catalogo (T4).
 *
 * Cableado real: `templateId`, `widthMm` / `heightMm` (legacy, se conservan
 * para no romper el `settings.json` guardado) y el aviso de geometria del
 * editor. 4820 ARTICULOS, la ruta y la LONGITUD son texto del mockup sin
 * fuente: van como UI estatica con insignia honesta.
 */
export function Seccion3Catalogo({
  label,
  override,
  onPatchLabel,
}: {
  label: AppSettings["label"];
  override: { activo: boolean; savedAt?: string } | null;
  onPatchLabel: (patch: Partial<AppSettings["label"]>) => void;
}) {
  const plantillaActiva = TEMPLATES.find((t) => t.id === label.templateId);
  const idObsoleto = plantillaActiva ? null : label.templateId;

  return (
    <section className={`${cardClear} flex flex-col gap-4 p-5`}>
      <h3 className={`${displayTitle} text-base`}>Catalogo</h3>

      {/* Texto del mockup sin fuente real: estatico y etiquetado. */}
      <div className={note} title={mockTitle}>
        <p>
          4820 ARTICULOS
          <span className={mockBadge}>mockup · sin datos / no cableado</span>
        </p>
        <p className="mt-1.5">
          Ruta: C:\Papicar
          <span className={mockBadge}>mockup · sin datos / no cableado</span>
        </p>
        <p className="mt-1.5">
          LONGITUD 14.82 km
          <span className={mockBadge}>mockup · sin datos / no cableado</span>
        </p>
      </div>

      <div className={note}>
        <p>
          Plantilla: <strong>{DEFAULT_TEMPLATE.name}</strong> = {DEFAULT_TEMPLATE.widthMm} x{" "}
          {DEFAULT_TEMPLATE.heightMm} mm = {DEFAULT_TEMPLATE.widthDots} x{" "}
          {DEFAULT_TEMPLATE.heightDots} dots a 203 dpi.
        </p>
        {idObsoleto && (
          <p className="mt-1.5">
            Guardada la <code>{idObsoleto}</code>, que ya no existe en el codigo. Se va a imprimir
            con la de 59 x 35 mm de todos modos. Pulsa Guardar para dejar el{" "}
            <code>settings.json</code> limpio.
          </p>
        )}
        <p className="mt-1.5">
          Los campos de ancho y alto de abajo ya no mandan: la medida sale de la plantilla. Se
          conservan para no romper el <code>settings.json</code> guardado.
        </p>
        {override?.activo && (
          <p className={`mt-3 ${calloutWarn}`}>
            <strong>Se esta imprimiendo con una geometria guardada desde el editor</strong> (
            {override.savedAt}), no con los numeros del codigo. Se guarda en{" "}
            <code>data/plantilla-override.json</code>. En{" "}
            <Link href="/editor" className="underline underline-offset-2">
              /editor
            </Link>{" "}
            hay un boton para descartarla y volver a la del codigo.
          </p>
        )}
      </div>

      <p className={calloutWarn}>
        <strong>El rollo hay que cambiarlo en la impresora, no aqui.</strong> El ancho del rollo
        de la seccion Dispositivo sale del <code>^PW</code>, pero el medio de verdad lo pone la
        impresora. Si el <code>^PW</code> no coincide con el rollo, lo que hace <code>^PW</code>{" "}
        es <strong>recortar</strong>: no escala, no centra y no avisa.
      </p>

      <div>
        <label htmlFor="templateId" className={labelClass}>
          Plantilla
        </label>
        <select
          id="templateId"
          value={plantillaActiva ? label.templateId : ""}
          onChange={(e) => onPatchLabel({ templateId: e.target.value })}
          className={inputClass}
        >
          {idObsoleto && <option value="">{idObsoleto} (obsoleta)</option>}
          {TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="widthMm" className={labelClass}>
            Ancho (mm)
          </label>
          <input
            id="widthMm"
            type="number"
            step="0.5"
            value={label.widthMm}
            onChange={(e) => onPatchLabel({ widthMm: Number(e.target.value) })}
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
            value={label.heightMm}
            onChange={(e) => onPatchLabel({ heightMm: Number(e.target.value) })}
            className={inputClass}
          />
        </div>
      </div>
      <p className={hint}>
        Ancho y alto legacy: ya no mandan, la medida sale de la plantilla.
      </p>
    </section>
  );
}
