"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  buttonClearSecondary,
  cardClear,
  displayTitle,
  hint,
  input,
  label as labelClass,
} from "@/components/ui";
import type { AppSettings } from "@/lib/settings/settings.types";
import type { StoredTemplate } from "@/lib/labels/templates.store";

/** Bloque de datos de apoyo: no es un campo, no debe parecerse a uno. */
const note =
  "rounded-md border border-line bg-surface-sunken px-3 py-3 text-xs leading-relaxed text-ink-soft";

/** `input` compartido: el select de plantilla lo estira a su fila. */
const inputClass = `${input} flex-1`;

/** Placa de taller: mismo gesto que las secciones 1 y 2 (acero #2F3336, seguridad #F5B301). */
const placa =
  "inline-grid size-7 shrink-0 place-items-center rounded font-mono text-sm font-bold";
const placaStyle = { backgroundColor: "#2F3336", color: "#F5B301" } as const;

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
  // Biblioteca real: las no archivadas (`GET /api/templates` sin filtros).
  // La biblioteca completa (ver/crear/duplicar/archivar/importar/exportar)
  // vive en la seccion 4; este select es el atajo para elegir la que imprime.
  const [plantillas, setPlantillas] = useState<StoredTemplate[] | null>(null);
  const [plantillasError, setPlantillasError] = useState<string | null>(null);
  const [usando, setUsando] = useState(false);
  const [usoMsg, setUsoMsg] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/templates", {
          cache: "no-store",
          signal: ctrl.signal,
        });
        const j = (await res.json().catch(() => null)) as {
          templates?: StoredTemplate[];
          error?: unknown;
        } | null;
        if (!res.ok || !j || !Array.isArray(j.templates)) {
          throw new Error(
            typeof j?.error === "string" ? j.error : `la app respondió ${res.status}`,
          );
        }
        if (!ctrl.signal.aborted) setPlantillas(j.templates);
      } catch (err) {
        if (!ctrl.signal.aborted) {
          setPlantillasError(
            `No se pudo leer la biblioteca: ${(err as Error).message}. La sección 4 la muestra completa.`,
          );
        }
      }
    })();
    return () => ctrl.abort();
  }, []);

  const plantillaActiva =
    plantillas?.find((t) => t.id === label.templateId) ?? null;
  const idObsoleto =
    plantillas !== null && !plantillaActiva ? label.templateId : null;

  // Activa la elegida: mismo patron que `TemplateLibrary.usar` — se lee el
  // settings entero y se escribe entero (`PUT /api/settings` valida el
  // objeto completo), cambiando solo `label.templateId`.
  const usar = (id: string) => {
    if (usando) return;
    setUsando(true);
    setUsoMsg(null);
    void (async () => {
      try {
        const actual = (await (await fetch("/api/settings")).json()) as AppSettings;
        const res = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...actual,
            label: { ...actual.label, templateId: id },
          }),
        });
        const j = (await res.json().catch(() => null)) as
          | (AppSettings & { error?: unknown })
          | null;
        if (!res.ok || !j || typeof j.error === "string") {
          throw new Error(
            j && typeof j.error === "string"
              ? j.error
              : `la app respondió ${res.status}`,
          );
        }
        onPatchLabel({ templateId: id });
        onImportado?.(j);
        setUsoMsg("Plantilla en uso: la próxima etiqueta sale con esa medida.");
      } catch (err) {
        setUsoMsg(`No se pudo activar: ${(err as Error).message}. No se cambió nada.`);
      } finally {
        setUsando(false);
      }
    })();
  };

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
        <h3 className="flex items-center gap-2.5">
          <span aria-hidden className={placa} style={placaStyle}>
            3
          </span>
          <span className={`${displayTitle} text-base`}>Catálogo y plantillas</span>
        </h3>
        <p className={hint}>Fuentes de datos de productos PAPICAR</p>
      </div>

      <div className={note}>
        <p className="text-sm font-bold text-ink">Sincronización del catálogo</p>
        <button
          type="button"
          onClick={recargar}
          disabled={recargando}
          className={`${buttonClearSecondary} mt-2 px-3 py-1.5 text-xs`}
          title="Relee el catálogo real (GET /api/products) e informa el conteo"
        >
          {recargando ? "Recargando…" : "Recargar ahora"}
        </button>
        {recarga && <p className="mt-1.5 text-xs text-ink">{recarga}</p>}
      </div>

      <div className={note}>
        <p className="text-sm font-semibold text-ink">Copias y perfiles</p>
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
            {importando ? "Importando…" : "Importar perfil"}
          </button>
        </div>
        {respaldoMsg && <p className="mt-1.5 text-xs text-ink">{respaldoMsg}</p>}
      </div>

      <div className={note}>
        <p className="text-sm font-semibold text-ink">Plantilla que imprime</p>
        {idObsoleto && (
          <p className="mt-1.5">
            Guardada la <code>{idObsoleto}</code>, que ya no está en la
            biblioteca (se archivó o se borró su origen). Elige otra abajo y
            pulsa Usar.
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
          Plantilla que imprime
        </label>
        {plantillas === null && !plantillasError ? (
          <p className={hint}>Leyendo la biblioteca…</p>
        ) : plantillasError ? (
          <p className={hint}>{plantillasError}</p>
        ) : plantillas!.length === 0 ? (
          <p className={hint}>
            No hay plantillas. Crea una en la sección 4 de esta página.
          </p>
        ) : (
          <>
            <div className="mt-1.5 flex gap-2">
              <select
                id="templateId"
                value={plantillaActiva ? label.templateId : ""}
                onChange={(e) => onPatchLabel({ templateId: e.target.value })}
                className={inputClass}
              >
                {idObsoleto && <option value="">{idObsoleto} (obsoleta)</option>}
                {plantillas!.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.widthMm} mm)
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => usar(label.templateId)}
                disabled={usando || plantillaActiva === null}
                className={`${buttonClearSecondary} shrink-0 px-3 py-2 text-xs`}
                title="Guarda esta plantilla como la que imprime (PUT /api/settings)"
              >
                {usando ? "Activando…" : "Usar"}
              </button>
            </div>
            {usoMsg && <p className="mt-1.5 text-xs text-ink">{usoMsg}</p>}
          </>
        )}
        <p className={hint}>
          La medida sale de la plantilla, no de estos ajustes.
        </p>
      </div>
    </section>
  );
}
