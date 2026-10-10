"use client";

import Link from "next/link";
import { useState } from "react";
import {
  badgeArchivedClear,
  buttonClearSecondary,
  cardClear,
  displayTitle,
  hint,
  input,
  label as labelClass,
} from "@/components/ui";
import type { AppSettings } from "@/lib/settings/settings.types";
import { TEMPLATES } from "@/lib/labels/label.template";

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

/** Ruta del mockup: solo texto, el campo esta deshabilitado. */
const RUTA_MOCKUP = "C:\\Papicar\\Data\\Articulos_Activos_2024.sqlite";

/**
 * Seccion 3: catalogo y plantillas (T7: replica del template).
 *
 * Texto del template literal con insignia honesta para lo sin fuente (ruta,
 * conteo, hora de sincronizacion). `Recargar Ahora` relee el catalogo real
 * (`GET /api/products`) e informa el conteo; `Exportar JSON` descarga los
 * settings reales (`GET /api/settings`); `Importar Perfil` sigue sin
 * cablear. Cableado real conservado: `templateId`, `widthMm` / `heightMm`
 * (legacy) y el aviso de geometria del editor.
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

  // Recarga real del catalogo: informa el conteo, no toca el texto del mockup.
  const [recargando, setRecargando] = useState(false);
  const [recarga, setRecarga] = useState<string | null>(null);

  const recargar = () => {
    setRecargando(true);
    setRecarga(null);
    void (async () => {
      try {
        const res = await fetch("/api/products", { cache: "no-store" });
        const j = (await res.json().catch(() => null)) as {
          products?: unknown[];
          error?: unknown;
        } | null;
        if (!res.ok || !j || !Array.isArray(j.products)) {
          setRecarga(
            typeof j?.error === "string"
              ? `No se pudo recargar: ${j.error}`
              : `No se pudo recargar (HTTP ${res.status}).`,
          );
          return;
        }
        setRecarga(
          `Catálogo real: ${j.products.length} artículos (GET /api/products, recién leído).`,
        );
      } catch (err) {
        setRecarga(`No se pudo recargar: ${(err as Error).message}.`);
      } finally {
        setRecargando(false);
      }
    })();
  };

  // Exportar real: descarga los settings guardados tal cual.
  const [exportando, setExportando] = useState(false);
  const [respaldoMsg, setRespaldoMsg] = useState<string | null>(null);

  const exportar = () => {
    setExportando(true);
    setRespaldoMsg(null);
    void (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!res.ok) {
          setRespaldoMsg(`No se pudo exportar (HTTP ${res.status}).`);
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "perfil-ajustes.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setRespaldoMsg("Perfil descargado (perfil-ajustes.json).");
      } catch (err) {
        setRespaldoMsg(`No se pudo exportar: ${(err as Error).message}.`);
      } finally {
        setExportando(false);
      }
    })();
  };

  return (
    <section className={`${cardClear} flex flex-col gap-4 p-5`}>
      <div>
        <h3 className={`${displayTitle} text-base`}>3. CATÁLOGO &amp; PLANTILLAS</h3>
        <p className={hint}>Fuentes de datos de productos PAPICAR</p>
      </div>

      <div className={note} title={mockTitle}>
        <p className={labelClass}>RUTA BASE DE DATOS LOCAL / ERP</p>
        <p className="mt-1.5 font-mono text-[11px] font-bold text-ink">
          4.820 Artículos
          <span className={mockBadge}>mockup · sin datos / no cableado</span>
        </p>
        <div className="mt-1.5 flex gap-2">
          <input
            value={RUTA_MOCKUP}
            readOnly
            disabled
            aria-label="Ruta de la base de datos (mockup)"
            title="Sin fuente real: la ruta del mockup no esta cableada."
            className={`${input} flex-1 font-mono text-xs`}
          />
          <button
            type="button"
            disabled
            aria-label="Elegir carpeta (mockup)"
            title="Sin fuente real: elegir carpeta no esta cableado."
            className={`${buttonClearSecondary} shrink-0 px-3 py-2 text-xs`}
          >
            Carpeta
          </button>
        </div>
      </div>

      <div className={note} title={mockTitle}>
        <p className="text-sm font-bold text-ink">Sincronización Catálogo</p>
        <p className="font-mono text-[11px] text-ink-soft">
          Última: Hoy 08:32 AM
          <span className={mockBadge}>mockup · sin datos / no cableado</span>
        </p>
        <button
          type="button"
          onClick={recargar}
          disabled={recargando}
          className={`${buttonClearSecondary} mt-2 px-3 py-1.5 text-xs`}
          title="Relee el catálogo real (GET /api/products) e informa el conteo"
        >
          {recargando ? "Recargando…" : "Recargar Ahora"}
        </button>
        {recarga && <p className="mt-1.5 text-xs text-ink">{recarga}</p>}
      </div>

      <div className={note}>
        <p className="text-sm font-semibold text-ink">COPIAS DE RESPALDO &amp; PERFILES</p>
        <p className="mt-1.5">
          Descarga o restaura toda la calibración física, márgenes y formatos de etiquetas
          guardados.
        </p>
        <p className="mt-1.5">
          Exportar descarga el <code>settings.json</code> real tal cual; importar desde un
          archivo todavía no está cableado.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportar}
            disabled={exportando}
            className={`${buttonClearSecondary} px-3 py-1.5 text-xs`}
            title="Descarga los settings reales (GET /api/settings)"
          >
            {exportando ? "Exportando…" : "Exportar JSON"}
          </button>
          <button
            type="button"
            disabled
            className={`${buttonClearSecondary} px-3 py-1.5 text-xs`}
            title="Sin fuente real: importar el perfil no esta cableado."
          >
            Importar Perfil
          </button>
        </div>
        {respaldoMsg && <p className="mt-1.5 text-xs text-ink">{respaldoMsg}</p>}
      </div>

      <div className={note}>
        <p className="text-sm font-semibold text-ink">Plantilla que imprime</p>
        {idObsoleto && (
          <p className="mt-1.5">
            Guardada la <code>{idObsoleto}</code>, que ya no existe en el código. Se
            va a imprimir con la de 59 x 35 mm de todos modos. Pulsa Guardar para
            dejar el <code>settings.json</code> limpio.
          </p>
        )}
        <p className="mt-1.5">
          Los campos de ancho y alto de abajo ya no mandan: la medida sale de la
          plantilla. Se conservan para no romper el <code>settings.json</code>{" "}
          guardado.
        </p>
        {override?.activo && (
          <p className={`mt-3 ${calloutWarn}`}>
            <strong>Se está imprimiendo con una geometría guardada desde el editor</strong>{" "}
            ({override.savedAt}), no con los números del código. Se guarda en{" "}
            <code>data/plantilla-override.json</code>. En{" "}
            <Link href="/editor" className="underline underline-offset-2">
              /editor
            </Link>{" "}
            hay un botón para descartarla y volver a la del código.
          </p>
        )}
      </div>

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
