"use client";

import { useMemo, useRef, useState } from "react";
import type { StoredTemplate } from "@/lib/labels/templates.store";
import {
  badge,
  badgeActiveClear,
  badgeArchivedClear,
  badgeRawClear,
  buttonClear,
  buttonClearSecondary,
  cardClear,
  cardTemplateActiveClear,
  cardTemplateClear,
  displayTitle,
  hint,
  input,
  label,
  select,
} from "@/components/ui";

/**
 * Biblioteca multi-plantilla (F4): grid + detalle, todo real.
 *
 * Los datos llegan del servidor (`/plantillas` los lee del store) y cada accion pega a
 * la API y refresca: nada de lo que se ve es decorativo. Lo que NO hay, no se muestra:
 * sin sistema de variables no hay seccion de variables, y sin historial de versiones no
 * hay "v3.4". Sin telemetria.
 */

const dots = (mm: number) => Math.round(mm * 8);

interface BibliotecaProps {
  initial: StoredTemplate[];
  activeId: string;
  /** Un codigo real del catalogo, para los thumbnails (el preview exige `?code=`). */
  sampleCode: string | null;
}

export function TemplateLibrary({ initial, activeId, sampleCode }: BibliotecaProps) {
  const [templates, setTemplates] = useState<StoredTemplate[]>(initial);
  const [activa, setActiva] = useState(activeId);
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [dpi, setDpi] = useState("todos");
  const [verArchivadas, setVerArchivadas] = useState(false);
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const categorias = useMemo(
    () => [...new Set(templates.map((t) => t.category))].sort((a, b) => a.localeCompare(b, "es")),
    [templates],
  );
  const dpis = useMemo(
    () => [...new Set(templates.map((t) => t.dpi))].sort((a, b) => a - b),
    [templates],
  );

  const visibles = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return templates.filter((t) => {
      if (!verArchivadas && t.archived) return false;
      if (categoria !== "todas" && t.category !== categoria) return false;
      if (dpi !== "todos" && t.dpi !== Number(dpi)) return false;
      if (needle !== "" && !`${t.name} ${t.id} ${t.category}`.toLowerCase().includes(needle)) {
        return false;
      }
      return true;
    });
  }, [templates, q, categoria, dpi, verArchivadas]);

  async function refrescar(): Promise<StoredTemplate[]> {
    const res = await fetch("/api/templates?incluirArchivadas=1");
    const data = (await res.json()) as { templates?: StoredTemplate[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? `La app respondio ${res.status}`);
    setTemplates(data.templates ?? []);
    return data.templates ?? [];
  }

  /** Tras cualquier cambio: lista fresca del servidor y seleccion al dia. */
  async function recargar(seleccionar: string | null) {
    const lista = await refrescar();
    setSeleccionada(seleccionar && lista.some((t) => t.id === seleccionar) ? seleccionar : null);
  }

  async function correr(accion: () => Promise<void>) {
    setOcupada(true);
    setFallo(null);
    try {
      await accion();
    } catch (err) {
      setFallo((err as Error).message);
    } finally {
      setOcupada(false);
    }
  }

  async function usar(id: string) {
    // La plantilla activa vive en settings (`label.templateId`): se lee entera y se
    // escribe entera, porque `PUT /api/settings` valida el objeto completo.
    const actual = await (await fetch("/api/settings")).json();
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...actual,
        label: { ...actual.label, templateId: id },
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? `La app respondio ${res.status}`);
    setActiva(id);
  }

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={`${displayTitle} text-2xl`}>Biblioteca de plantillas</h1>
          <p className="mt-1 text-sm text-muted">
            {templates.filter((t) => !t.archived).length} activas · la que imprime es la marcada
            como activa
          </p>
        </div>
        <NuevaEnBlanco
          ocupada={ocupada}
          onError={(mensaje) => setFallo(mensaje)}
          onCrear={(id) => void correr(() => recargar(id))}
        />
      </header>

      {fallo && (
        <p role="alert" className="rounded-card border border-error bg-error-soft px-4 py-3 text-sm text-error">
          {fallo}
        </p>
      )}

      <section className={`${cardClear} flex flex-col gap-3 p-4`}>
        <div className="flex flex-wrap gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, id o categoria"
            aria-label="Buscar plantillas"
            className={`${input} h-11 max-w-sm flex-1`}
          />
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            aria-label="Filtrar por categoria"
            className={`${select} h-11 w-auto`}
          >
            <option value="todas">Todas las categorias</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={dpi}
            onChange={(e) => setDpi(e.target.value)}
            aria-label="Filtrar por DPI"
            className={`${select} h-11 w-auto`}
          >
            <option value="todos">Todos los DPI</option>
            {dpis.map((d) => (
              <option key={d} value={String(d)}>
                {d} dpi
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-strong">
            <input
              type="checkbox"
              checked={verArchivadas}
              onChange={(e) => setVerArchivadas(e.target.checked)}
              className="h-4 w-4"
            />
            Archivadas
          </label>
        </div>
      </section>

      {visibles.length === 0 ? (
        <section className={`${cardClear} p-8 text-center`}>
          <p className="text-sm text-muted">
            No hay plantillas con esos filtros. Limpia la busqueda o crea una en blanco.
          </p>
        </section>
      ) : (
        <section aria-label="Plantillas" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibles.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              esActiva={t.id === activa}
              sampleCode={sampleCode}
              ocupada={ocupada}
              onVer={() => setSeleccionada(t.id)}
              onUsar={() => void correr(() => usar(t.id))}
            />
          ))}
        </section>
      )}

      {seleccionada && (
        <TemplateDetail
          key={seleccionada}
          template={templates.find((t) => t.id === seleccionada) ?? null}
          esActiva={seleccionada === activa}
          ocupada={ocupada}
          onCerrar={() => setSeleccionada(null)}
          onCambio={(siguiente) => void correr(() => recargar(siguiente))}
          onUsar={(id) => void correr(() => usar(id))}
          onError={(mensaje) => setFallo(mensaje)}
        />
      )}

      <ImportarPlantilla ocupada={ocupada} onImportada={(id) => void correr(() => recargar(id))} />
    </main>
  );
}

function TemplateCard({
  template: t,
  esActiva,
  sampleCode,
  ocupada,
  onVer,
  onUsar,
}: {
  template: StoredTemplate;
  esActiva: boolean;
  sampleCode: string | null;
  ocupada: boolean;
  onVer: () => void;
  onUsar: () => void;
}) {
  const estructurada = t.kind === "estructurada";
  const marco = { aspectRatio: `${dots(t.widthMm)} / ${dots(t.heightMm)}` };

  return (
    <article className={esActiva ? cardTemplateActiveClear : cardTemplateClear}>
      <div className="overflow-hidden rounded-t-[inherit] border-b border-edge bg-canvas">
        {estructurada && sampleCode ? (
          <img
            src={`/api/labels/preview?code=${encodeURIComponent(sampleCode)}&template=${encodeURIComponent(t.id)}`}
            alt={`Vista previa de ${t.name}`}
            style={marco}
            className="h-auto w-full bg-white"
            loading="lazy"
          />
        ) : (
          <div style={marco} className="grid w-full place-items-center p-4">
            <p className="text-center text-xs leading-relaxed text-muted">
              {estructurada
                ? "Sin producto de muestra: no hay vista previa"
                : "RAW — sin vista previa, se envia tal cual"}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-strong">{t.name}</h2>
          {esActiva && <span className={badgeActiveClear}>Activa</span>}
          {!estructurada && <span className={badgeRawClear}>RAW</span>}
          {t.archived && <span className={badgeArchivedClear}>Archivada</span>}
        </div>
        <p className="text-xs tabular-nums text-muted">
          {t.widthMm} × {t.heightMm} mm · {t.dpi} dpi · {t.category}
          {estructurada && ` · ${t.zones?.length ?? 0} zonas`}
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          <button type="button" onClick={onVer} className={buttonClearSecondary}>
            Detalle
          </button>
          {!esActiva && !t.archived && (
            <button type="button" onClick={onUsar} disabled={ocupada} className={buttonClear}>
              Usar
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function NuevaEnBlanco({
  ocupada,
  onCrear,
  onError,
}: {
  ocupada: boolean;
  onCrear: (id: string) => void;
  onError: (mensaje: string) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={buttonClear}>
        Nueva en blanco
      </button>
    );
  }

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const final = nombre.trim();
        if (!final) return;
        void (async () => {
          const res = await fetch("/api/templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: final, from: "blanco" }),
          });
          const data = (await res.json()) as StoredTemplate & { error?: string };
          if (!res.ok) throw new Error(data.error ?? `La app respondio ${res.status}`);
          setNombre("");
          setAbierto(false);
          onCrear(data.id);
        })().catch((err: Error) => onError(err.message));
      }}
    >
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre de la plantilla"
        aria-label="Nombre de la plantilla nueva"
        className={`${input} h-11 w-56`}
      />
      <button type="submit" disabled={ocupada || nombre.trim() === ""} className={buttonClear}>
        Crear
      </button>
    </form>
  );
}

function ImportarPlantilla({
  ocupada,
  onImportada,
}: {
  ocupada: boolean;
  onImportada: (id: string) => void;
}) {
  const [formato, setFormato] = useState<"json" | "zpl">("json");
  const [nombre, setNombre] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <section className={`${cardClear} p-4`}>
      <h2 className="text-sm font-semibold text-strong">Importar</h2>
      <p className={hint}>
        JSON nuestro (lo que exporta la biblioteca, siempre como copia nueva) o ZPL tal cual
        (plantilla raw: sin vista previa, se envia verbatim).
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={formato}
          onChange={(e) => setFormato(e.target.value as "json" | "zpl")}
          aria-label="Formato a importar"
          className={`${select} h-11 w-auto`}
        >
          <option value="json">JSON de la biblioteca</option>
          <option value="zpl">ZPL directo (raw)</option>
        </select>
        <input
          ref={fileRef}
          type="file"
          accept={formato === "json" ? ".json" : ".zpl,.txt"}
          aria-label="Archivo a importar"
          className="text-sm text-strong"
        />
        {formato === "zpl" && (
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre (opcional)"
            aria-label="Nombre de la plantilla raw"
            className={`${input} h-11 w-52`}
          />
        )}
        <button
          type="button"
          disabled={ocupada}
          className={buttonClearSecondary}
          onClick={() => {
            const file = fileRef.current?.files?.[0];
            if (!file) {
              setMensaje("Elegi un archivo primero.");
              return;
            }
            setMensaje(null);
            void (async () => {
              // El archivo se lee entero en el cliente y se POSTea: el servidor nunca ve
              // rutas locales. Si pesa mas de 256 KB, lo rechaza el endpoint.
              const content = await file.text();
              const res = await fetch("/api/templates/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                  formato === "json"
                    ? { format: "json", content }
                    : { format: "zpl", content, ...(nombre.trim() ? { name: nombre.trim() } : {}) },
                ),
              });
              const data = (await res.json()) as StoredTemplate & { error?: string };
              if (!res.ok) {
                setMensaje(data.error ?? `La app respondio ${res.status}`);
                return;
              }
              setNombre("");
              if (fileRef.current) fileRef.current.value = "";
              onImportada(data.id);
            })().catch((err: Error) => setMensaje(err.message));
          }}
        >
          Importar
        </button>
      </div>
      {mensaje && (
        <p role="alert" className="mt-2 text-sm text-error">
          {mensaje}
        </p>
      )}
    </section>
  );
}

function TemplateDetail({
  template: t,
  esActiva,
  ocupada,
  onCerrar,
  onCambio,
  onUsar,
  onError,
}: {
  template: StoredTemplate | null;
  esActiva: boolean;
  ocupada: boolean;
  onCerrar: () => void;
  /** Id a seleccionar tras recargar la lista del servidor, o null para cerrar. */
  onCambio: (siguiente: string | null) => void;
  onUsar: (id: string) => void;
  onError: (mensaje: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(t?.name ?? "");
  const [categoria, setCategoria] = useState(t?.category ?? "");

  if (!t) return null;
  // Const para los closures de abajo: el narrowing de un parametro no sobrevive dentro
  // de funciones anidadas, el de una const si.
  const tpl: StoredTemplate = t;

  const estructurada = t.kind === "estructurada";
  const porKind = (t.zones ?? []).reduce<Record<string, number>>((acc, z) => {
    acc[z.kind] = (acc[z.kind] ?? 0) + 1;
    return acc;
  }, {});
  // Solo la 59x35 estructurada y activa se abre en /editor: es la unica cuya geometria
  // entiende el override. Las demas explican el limite en vez de un boton que miente.
  const puedeEditar = estructurada && t.id === "papicar-59x35" && esActiva;

  async function mutar(url: string, init: RequestInit): Promise<StoredTemplate> {
    const res = await fetch(url, init);
    const data = (await res.json()) as StoredTemplate & { error?: string };
    if (!res.ok) throw new Error(data.error ?? `La app respondio ${res.status}`);
    return data;
  }

  async function archivar(archived: boolean) {
    try {
      const siguiente = await mutar(`/api/templates/${encodeURIComponent(tpl.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      onCambio(siguiente.id);
    } catch (err) {
      onError((err as Error).message);
    }
  }

  async function duplicar() {
    try {
      const copia = await mutar(`/api/templates/${encodeURIComponent(tpl.id)}/duplicate`, {
        method: "POST",
      });
      onCambio(copia.id);
    } catch (err) {
      onError((err as Error).message);
    }
  }

  async function exportar() {
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(tpl.id)}`);
      const data = (await res.json()) as StoredTemplate & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `La app respondio ${res.status}`);
      // Nuestro formato de intercambio: envoltorio con version, para que el import sepa
      // que es nuestro y no un JSON cualquiera.
      const blob = new Blob([JSON.stringify({ format: "plantilla", version: 1, template: data }, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tpl.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      onError((err as Error).message);
    }
  }

  return (
    <section aria-label={`Detalle de ${t.name}`} className={`${cardClear} p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-strong">{t.name}</h2>
          {esActiva && <span className={badgeActiveClear}>Activa</span>}
          {!estructurada && <span className={badgeRawClear}>RAW</span>}
          {t.archived && <span className={badgeArchivedClear}>Archivada</span>}
        </div>
        <button type="button" onClick={onCerrar} className={buttonClearSecondary}>
          Cerrar
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div className="rounded-md border border-edge bg-canvas p-3">
          <dt className="text-xs text-muted">Medida</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-strong">
            {t.widthMm} × {t.heightMm} mm
          </dd>
        </div>
        <div className="rounded-md border border-edge bg-canvas p-3">
          <dt className="text-xs text-muted">En dots (203 dpi)</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-strong">
            {dots(t.widthMm)} × {dots(t.heightMm)}
          </dd>
        </div>
        <div className="rounded-md border border-edge bg-canvas p-3">
          <dt className="text-xs text-muted">DPI</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-strong">{t.dpi}</dd>
        </div>
        <div className="rounded-md border border-edge bg-canvas p-3">
          <dt className="text-xs text-muted">Categoria</dt>
          <dd className="mt-0.5 font-semibold text-strong">{t.category}</dd>
        </div>
      </dl>

      {estructurada ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-strong">
            Zonas ({t.zones?.length ?? 0})
          </h3>
          <p className="mt-1 text-xs text-muted">
            {Object.entries(porKind)
              .map(([kind, n]) => `${n} ${kind}`)
              .join(" · ")}
            {t.zonesWithoutBarcode && t.zonesWithoutBarcode.length > 0
              ? ` · variante sin codigo (${t.zonesWithoutBarcode.length} zonas)`
              : ""}
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {(t.zones ?? []).map((z, i) => (
              <li key={i} className="text-xs tabular-nums text-strong">
                <span className={`${badge} bg-canvas text-muted`}>{z.kind}</span>{" "}
                {z.kind === "text" ? `origen ${(z as { source?: string }).source ?? "?"}` : ""}
                {z.kind === "barcode" ? `modulo ${(z as { moduleWidth?: number }).moduleWidth ?? "?"}` : ""}
                {" "}en {z.x},{z.y}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-warn-line bg-warn-soft px-3 py-2 text-xs leading-relaxed text-warn">
          ZPL directo: se envia tal cual a la impresora, sin adaptacion ni vista previa. Lo que
          hay en el archivo es lo que sale.
        </p>
      )}

      <p className="mt-3 text-xs text-muted">
        id <span className="tabular-nums">{t.id}</span> · creada{" "}
        {new Date(t.createdAt).toLocaleString("es-UY")} · actualizada{" "}
        {new Date(t.updatedAt).toLocaleString("es-UY")}
      </p>

      {editando ? (
        <form
          className="mt-4 flex flex-wrap items-end gap-2 border-t border-edge pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              try {
                const siguiente = await mutar(`/api/templates/${encodeURIComponent(t.id)}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: nombre.trim(), category: categoria.trim() }),
                });
                setEditando(false);
                onCambio(siguiente.id);
              } catch (err) {
                onError((err as Error).message);
              }
            })();
          }}
        >
          <div>
            <label htmlFor="tpl-nombre" className={label}>
              Nombre
            </label>
            <input
              id="tpl-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={`${input} mt-1 h-11 w-64`}
            />
          </div>
          <div>
            <label htmlFor="tpl-categoria" className={label}>
              Categoria
            </label>
            <input
              id="tpl-categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className={`${input} mt-1 h-11 w-52`}
            />
          </div>
          <button
            type="submit"
            disabled={ocupada || nombre.trim() === "" || categoria.trim() === ""}
            className={buttonClear}
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() => {
              setEditando(false);
              setNombre(t.name);
              setCategoria(t.category);
            }}
            className={buttonClearSecondary}
          >
            Cancelar
          </button>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-edge pt-4">
          {puedeEditar ? (
            <a href="/editor" className={buttonClear}>
              Abrir en editor
            </a>
          ) : (
            <p className="w-full text-xs leading-relaxed text-muted">
              El editor solo abre la 59x35 activa
              {!estructurada
                ? " (esta es raw: ZPL opaco, no hay geometria que editar)"
                : t.id !== "papicar-59x35"
                  ? " (las coordenadas del editor son de ese rollo y no valen en otro)"
                  : " (esta 59x35 no es la activa: usala primero)"}
              .
            </p>
          )}
          {!esActiva && !t.archived && (
            <button type="button" onClick={() => onUsar(t.id)} disabled={ocupada} className={buttonClear}>
              Usar
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setNombre(t.name);
              setCategoria(t.category);
              setEditando(true);
            }}
            disabled={ocupada}
            className={buttonClearSecondary}
          >
            Renombrar
          </button>
          <button type="button" onClick={() => void duplicar()} disabled={ocupada} className={buttonClearSecondary}>
            Duplicar
          </button>
          <button type="button" onClick={() => void exportar()} disabled={ocupada} className={buttonClearSecondary}>
            Exportar
          </button>
          <button
            type="button"
            onClick={() => void archivar(!t.archived)}
            disabled={ocupada}
            className={buttonClearSecondary}
          >
            {t.archived ? "Desarchivar" : "Archivar"}
          </button>
        </div>
      )}
    </section>
  );
}
