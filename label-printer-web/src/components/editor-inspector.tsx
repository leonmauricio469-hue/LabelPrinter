"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  badge,
  buttonClear,
  buttonClearSecondary,
  cardClear,
  hint,
  input,
  label,
  monoClear,
  tabClear,
  tabClearActive,
} from "@/components/ui";

/**
 * Paneles F6 del workbench `/editor` (pestanas ZPL/Origen, guardar, prueba).
 *
 * Viven aqui y no en `page.tsx` para no inflar la pagina: la pagina lleva el
 * estado, el lienzo y los gestos; aqui van los paneles que lo miran. Nada de
 * lo que hay aqui inventa datos: el ZPL viene de `GET /api/editor/zpl`, el
 * origen de la `source` real de cada zona y la biblioteca/impresion de sus
 * endpoints reales.
 */

export type AnyZone = Record<string, unknown> & { kind: string };

/**
 * De donde sale el texto de cada zona: su fuente REAL.
 *
 * Los campos de producto (nombre, precio, referencia, codigo) varian por
 * producto y salen del catalogo por codigo; el resto son fijos de la
 * plantilla. Sin mapeo CSV ni ERP porque no existen: no hay columnas que
 * mapear ni sistema externo que leer. Sin RFID, sin invertido y sin
 * "simulacion termica" (el preview ya es el ZPL real).
 */
const FUENTE_TEXTO: Record<string, string> = {
  productName: "Nombre del producto. Varia por producto: sale del catalogo por codigo.",
  price: "Precio del producto. Varia por producto. Sin $ por decision 2.5.",
  reference: "Referencia del producto. Varia por producto. Se imprime con el prefijo «REF: ».",
  barcode: "Codigo de barras del producto. Varia por producto.",
  barcodeData:
    "Digitos reales del simbolo: los que se imprimen (con el 0 delante de los UPC-A y el digito corregido). Varia por producto.",
  referenceLabel: "Texto fijo «REF:». No varia por producto.",
  header: "Cabecera fija o nombre del negocio. No varia por producto.",
  fixed:
    "Texto libre escrito por el operador. No varia por producto: sale tal cual (plegado a ASCII, sin mayusculas forzadas).",
};

export function OrigenTab({
  zones,
  etiquetaDe,
  logoSerieIdx,
}: {
  zones: AnyZone[];
  etiquetaDe: (z: AnyZone, i: number) => string;
  /** Indice del logo de serie (el primero `graphic`): los demas son duplicados del operador. */
  logoSerieIdx?: number;
}) {
  return (
    <div>
      <ul className="flex flex-col gap-2">
        {zones.map((z, i) => (
          <li key={i} className="rounded-md border border-edge bg-canvas px-3 py-2">
            <p className="flex flex-wrap items-center gap-2 text-xs text-strong">
              <span className={`${badge} bg-panel text-muted`}>{z.kind}</span>
              <strong>{etiquetaDe(z, i)}</strong>
              <span className="tabular-nums text-muted">
                en {String(z.x)},{String(z.y)}
              </span>
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {z.kind === "text"
                ? (FUENTE_TEXTO[String(z.source ?? "")] ??
                  `Origen «${String(z.source ?? "?")}»: fijo de la plantilla.`)
                : z.kind === "barcode"
                  ? String(z.source ?? "barcode") === "fixed"
                    ? `Codigo fijo «${String(z.text ?? "")}» escrito por el operador. Sale SIEMPRE en Code 128 (^BCN), sin auto-EAN. No varia por producto; se puede mover, estirar y borrar.`
                    : "Simbolo del codigo. La symbologia la decide planBarcode por producto (EAN-13 o Code 128); el alto y el modulo son de la plantilla."
                  : z.kind === "graphic"
                    ? logoSerieIdx !== undefined && i !== logoSerieIdx
                      ? "Duplicado del logo puesto por el operador (mismo bitmap, otra posicion). No varia por producto; se puede mover, estirar, cambiar y borrar."
                      : "Logo fijo (bitmap ^GFA). No varia por producto."
                    : z.kind === "rect"
                      ? "Rectangulo libre dibujado por el operador (^GB hueco, esquinas vivas). No varia por producto; se puede mover, estirar y borrar."
                      : z.kind === "line"
                        ? "Linea libre dibujada por el operador (^GB colapsado, solo horizontal o vertical). No varia por producto; se puede mover, estirar y borrar."
                        : "Marco fijo (margen del papel). No varia y no se edita."}
            </p>
          </li>
        ))}
      </ul>
      <p className={hint}>
        Las variables salen del catalogo por codigo de producto. No hay mapeo CSV ni ERP (no
        existen), ni RFID, ni modo invertido. La vista previa es el ZPL real, no una simulacion
        termica. Sin parametros de cabezal: la densidad no es verificable sin hardware.
      </p>
    </div>
  );
}

/** Pestana ZPL: el texto real del endpoint, con boton de copiar verbatim. */
export function ZplTab({
  texto,
  cargando,
  error,
  captions,
  avisoSinAplicar,
  onActualizar,
}: {
  texto: string | null;
  cargando: boolean;
  error: string | null;
  captions: string[];
  avisoSinAplicar: string | null;
  onActualizar: () => void;
}) {
  return (
    <div>
      {captions.map((c, i) => (
        <p key={i} className="text-xs leading-relaxed text-muted">
          {c}
        </p>
      ))}
      {avisoSinAplicar && (
        <p className="mt-2 rounded-md border border-warn-line bg-warn-soft px-3 py-2 text-xs text-warn">
          {avisoSinAplicar}
        </p>
      )}
      {cargando && <p className="mt-2 text-xs text-muted">generando el ZPL...</p>}
      {error && (
        <p role="alert" className="mt-2 rounded-md border border-error bg-error-soft px-3 py-2 text-xs text-error">
          {error}
        </p>
      )}
      {/* El volcado ZPL crudo no se muestra: ruido para el operador. Quedan los
          captions (contexto real) y Actualizar. El texto sigue disponible via
          GET /api/editor/zpl para soporte. */}
      {texto !== null && !error && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={onActualizar} className={buttonClearSecondary}>
            Actualizar
          </button>
        </div>
      )}
    </div>
  );
}

/** Pestanas del bloque inferior del workbench: ZPL real y origen de cada zona. */
export function EditorTabs({
  tab,
  onTab,
  zpl,
  origen,
}: {
  tab: "zpl" | "origen";
  onTab: (t: "zpl" | "origen") => void;
  zpl: ReactNode;
  origen: ReactNode;
}) {
  return (
    <div className={`${cardClear} min-w-0 p-4`}>
      <div role="tablist" aria-label="Vista del editor" className="mb-3 flex gap-1">
        {(["zpl", "origen"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            type="button"
            onClick={() => onTab(t)}
            className={tab === t ? tabClearActive : tabClear}
          >
            {t === "zpl" ? "ZPL" : "Origen"}
          </button>
        ))}
      </div>
      {tab === "zpl" ? zpl : origen}
    </div>
  );
}

/**
 * Guardar como plantilla: la geometria efectiva actual, como plantilla nueva.
 *
 * Guarda lo que se ve en el canvas (zonas actuales, con el override ya
 * aplicado encima si lo habia). Siempre crea una plantilla NUEVA con id nuevo:
 * nunca reemplaza la activa ni toca el override. Si la geometria se pisa o se
 * sale, no se guarda (misma regla que Aplicar).
 */
export function GuardarPlantillaPanel({
  nombre,
  onNombre,
  ocupado,
  puede,
  motivoBloqueo,
  resultado,
  error,
  onGuardar,
}: {
  nombre: string;
  onNombre: (v: string) => void;
  ocupado: boolean;
  puede: boolean;
  motivoBloqueo: string | null;
  resultado: { id: string; name: string } | null;
  error: string | null;
  onGuardar: () => void;
}) {
  return (
    <div className={`${cardClear} min-w-0 p-4`}>
      <h3 className="mb-2 text-sm font-semibold tracking-tight text-strong">
        Guardar como plantilla
      </h3>
      <p className={hint}>
        Crea una plantilla estructurada 59x35 nueva en la biblioteca, con la geometria que se ve
        en el canvas. Siempre con id nuevo: la activa sigue intacta.
      </p>
      <label htmlFor="editor-nombre-plantilla" className={`${label} mt-3 block`}>
        Nombre
      </label>
      <input
        id="editor-nombre-plantilla"
        value={nombre}
        onChange={(e) => onNombre(e.target.value)}
        placeholder="Mi variante 59x35"
        className={`${input} mt-1`}
      />
      {motivoBloqueo && (
        <p className="mt-2 rounded-md border border-warn-line bg-warn-soft px-3 py-2 text-xs text-warn">
          {motivoBloqueo}
        </p>
      )}
      {resultado && (
        <p className="mt-2 rounded-md border border-success bg-success-soft px-3 py-2 text-xs text-success">
          Guardada «{resultado.name}» ({resultado.id}).{" "}
          <a href="/plantillas" className="underline">
            Ver en la biblioteca
          </a>
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 rounded-md border border-error bg-error-soft px-3 py-2 text-xs text-error">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={onGuardar}
        disabled={ocupado || !puede}
        className={`${buttonClear} mt-3 w-full`}
      >
        {ocupado ? "guardando..." : "Guardar como plantilla"}
      </button>
    </div>
  );
}

/**
 * Imprimir prueba: gasta 1 etiqueta de verdad.
 *
 * Imprime la plantilla ACTIVA con un codigo real del catalogo, por el mismo
 * camino que la impresion normal (`POST /api/labels` con `templateId`). El
 * resultado se muestra verbatim. Si hay cambios sin aplicar, se avisa: la
 * prueba imprime lo guardado, no lo que se ve.
 */
export function PruebaImpresionPanel({
  productos,
  muestra,
  onMuestra,
  plantillaNombre,
  ocupado,
  puede,
  avisoSinAplicar,
  resultado,
  error,
  onImprimir,
}: {
  productos: { code: string; name: string; barcode: string; price: number }[];
  muestra: string;
  onMuestra: (v: string) => void;
  plantillaNombre: string;
  ocupado: boolean;
  puede: boolean;
  avisoSinAplicar: string | null;
  resultado: string | null;
  error: string | null;
  onImprimir: () => void;
}) {
  return (
    <div className={`${cardClear} min-w-0 p-4`}>
      <h3 className="mb-2 text-sm font-semibold tracking-tight text-strong">Imprimir prueba</h3>
      <p className={hint}>
        Imprime 1 etiqueta de verdad con la plantilla activa («{plantillaNombre}»). Gasta papel.
      </p>
      <label htmlFor="editor-muestra" className={`${label} mt-3 block`}>
        Producto de muestra (del catalogo)
      </label>
      {productos.length > 0 ? (
        <select
          id="editor-muestra"
          value={muestra}
          onChange={(e) => onMuestra(e.target.value)}
          className={`${input} mt-1`}
        >
          {productos.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name} · {p.code}
            </option>
          ))}
        </select>
      ) : (
        <p className="mt-1 text-xs text-warn">Sin productos de muestra: no hay nada que probar.</p>
      )}
      {avisoSinAplicar && (
        <p className="mt-2 rounded-md border border-warn-line bg-warn-soft px-3 py-2 text-xs text-warn">
          {avisoSinAplicar}
        </p>
      )}
      {resultado !== null && (
        <pre className={`${monoClear} mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all`}>
          {resultado}
        </pre>
      )}
      {error && (
        <p role="alert" className="mt-2 rounded-md border border-error bg-error-soft px-3 py-2 text-xs text-error">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={onImprimir}
        disabled={ocupado || !puede}
        className={`${buttonClear} mt-3 w-full`}
      >
        {ocupado ? "imprimiendo..." : "Imprimir prueba (1 etiqueta)"}
      </button>
    </div>
  );
}
