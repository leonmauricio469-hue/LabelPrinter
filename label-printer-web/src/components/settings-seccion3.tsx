"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  buttonClearSecondary,
  cardClear,
  displayTitle,
  hint,
  input,
  label as labelClass,
} from "@/components/ui";
import type { AppSettings } from "@/lib/settings/settings.types";
import { TEMPLATES } from "@/lib/labels/label.template";

/** Bloque de datos de apoyo: no es un campo, no debe parecerse a uno. */
const note =
  "rounded-md border border-line bg-surface-sunken px-3 py-3 text-xs leading-relaxed text-ink-soft";

/** `input` compartido con la separacion respecto de la etiqueta de arriba. */
const inputClass = `mt-1.5 ${input}`;

const calloutWarn =
  "border border-warn-line bg-warn-soft px-3 py-2.5 text-xs leading-relaxed text-warn";

/**
 * Seccion 3: catalogo y plantillas.
 *
 * `Recargar Ahora` relee el catalogo real (`GET /api/products`) e informa
 * el conteo; `Exportar JSON` descarga los settings reales
 * (`GET /api/settings`); `Importar Perfil` lee el JSON elegido y lo guarda
 * (`PUT /api/settings`, merge en servidor). Cableado real conservado:
 * `templateId` (la geometria sale de la plantilla, no de settings) y el
 * aviso de geometria del editor.
 */
export function Seccion3Catalogo({
  label,
  override,
  onPatchLabel,
  onImportado,
}: {
  label: AppSettings["label"];
  override: { activo: boolean; savedAt?: string } | null;
  onPatchLabel: (patch: Partial<AppSettings["label"]>) => void;
  /**
   * Opcional: la pagina duena del estado lo cablea para refrescar el
   * formulario entero y marcar `lastSyncOk` como el Guardar. Sin cablear,
   * se refresca solo `label` y el mensaje pide recarga (limite honesto).
   */
  onImportado?: (settings: AppSettings) => void;
}) {
  const plantillaActiva = TEMPLATES.find((t) => t.id === label.templateId);
  const idObsoleto = plantillaActiva ? null : label.templateId;

  // Recarga real del catalogo: informa el conteo recien leido.
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

  // Importar real: lee el JSON elegido, lo valida como objeto y lo guarda
  // (PUT /api/settings, merge en servidor). Si el archivo no es JSON o el
  // servidor lo rechaza (400), se avisa y el formulario queda intacto.
  // `onImportado` lo cablea la pagina (`page.tsx`): aplica el objeto entero,
  // marca `lastSyncOk` y refresca. Sin él, solo se refresca `label`.
  const [archivo, setArchivo] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const importar = () => {
    if (!archivo || importando) return;
    setImportando(true);
    setRespaldoMsg(null);
    void (async () => {
      try {
        const texto = await archivo.text();
        let datos: unknown;
        try {
          datos = JSON.parse(texto);
        } catch {
          setRespaldoMsg(
            `No se pudo importar ${archivo.name}: no es un JSON válido. No se cambió nada.`,
          );
          return;
        }
        if (typeof datos !== "object" || datos === null || Array.isArray(datos)) {
          setRespaldoMsg(
            `No se pudo importar ${archivo.name}: no es un objeto de ajustes. No se cambió nada.`,
          );
          return;
        }
        const res = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(datos),
        });
        const j = (await res.json().catch(() => null)) as
          | (AppSettings & { error?: unknown })
          | null;
        if (!res.ok || !j || typeof j.error === "string") {
          setRespaldoMsg(
            j && typeof j.error === "string"
              ? `No se pudo importar ${archivo.name}: ${j.error}. No se cambió nada.`
              : `No se pudo importar ${archivo.name} (HTTP ${res.status}). No se cambió nada.`,
          );
          return;
        }
        onPatchLabel(j.label);
        onImportado?.(j);
        setArchivo(null);
        if (fileRef.current) fileRef.current.value = "";
        setRespaldoMsg(
          onImportado
            ? `Perfil ${archivo.name} importado y guardado.`
            : `Perfil ${archivo.name} importado y guardado. Recarga la página para ver todos los valores en el formulario.`,
        );
      } catch (err) {
        setRespaldoMsg(
          `No se pudo importar ${archivo.name}: ${(err as Error).message}. No se cambió nada.`,
        );
      } finally {
        setImportando(false);
      }
    })();
  };

  return (
    <section className={`${cardClear} flex flex-col gap-4 p-5`}>
      <div>
        <h3 className={`${displayTitle} text-base`}>3. CATÁLOGO &amp; PLANTILLAS</h3>
        <p className={hint}>Fuentes de datos de productos PAPICAR</p>
      </div>

      <div className={note}>
        <p className="text-sm font-bold text-ink">Sincronización Catálogo</p>
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
          Exportar descarga el <code>settings.json</code> real tal cual; importar lee
          el JSON elegido y lo guarda (<code>PUT /api/settings</code>).
        </p>
        <div className="mt-2 flex flex-col gap-2">
          <label htmlFor="perfil-archivo" className={labelClass}>
            Archivo de perfil
          </label>
          <input
            id="perfil-archivo"
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className={input}
          />
        </div>
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
            onClick={importar}
            disabled={!archivo || importando}
            className={`${buttonClearSecondary} px-3 py-1.5 text-xs`}
            title="Lee el JSON elegido y lo guarda (PUT /api/settings)"
          >
            {importando ? "Importando…" : "Importar Perfil"}
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
          La medida sale de la plantilla: los campos de ancho y alto se
          quitaron de esta pantalla pero siguen en el{" "}
          <code>settings.json</code> guardado, sin romperse.
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
        <p className={hint}>
          La medida sale de la plantilla, no de estos ajustes.
        </p>
      </div>
    </section>
  );
}
