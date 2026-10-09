"use client";

import { useEffect, useState } from "react";
import { TemplateLibrary } from "@/components/template-detail";
import { PrintStatus, type PrintState } from "@/components/print-status";
import type { StoredTemplate } from "@/lib/labels/templates.store";
import type { Product } from "@/lib/products/product.types";
import { DEFAULT_TEMPLATE } from "@/lib/labels/label.template";

/**
 * Tab Plantillas del hub (`/`).
 *
 * F13: `/plantillas` era la UNICA de las 4 paginas que no se podia mover tal cual,
 * porque es un Server Component: lee la biblioteca, los settings y el catalogo
 * directo del disco (`templates.store`, `settings.store`, `product.catalog.repository`
 * — este ultimo `server-only` por transitividad) y se los pasa a `TemplateLibrary`.
 * Un tab del hub es cliente (tabs + `?tab=` + render perezoso), asi que esos tres
 * reads se hacen por los MISMOS endpoints que ya exponen esos datos:
 *
 * - `listTemplates({ incluirArchivadas: true })` -> `GET /api/templates?incluirArchivadas=1`
 * - `readSettings().label.templateId` -> `GET /api/settings` (`label.templateId`)
 * - `getProductRepository().list()[0]?.code` -> `GET /api/products` (`products[0].code`)
 *
 * `TemplateLibrary` (grid + detalle + CRUD + importar) se reutiliza intacto: misma
 * logica, mismos endpoints, mismos estados. Solo se agrega el cargador honesto
 * (busy/error, sin datos inventados) mientras llegan las tres respuestas.
 */
export function SeccionPlantillas() {
  const [initial, setInitial] = useState<StoredTemplate[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sampleCode, setSampleCode] = useState<string | null>(null);
  const [state, setState] = useState<PrintState>({ kind: "busy", message: "Cargando biblioteca..." });

  useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      try {
        const [rt, rs, rp] = await Promise.all([
          fetch("/api/templates?incluirArchivadas=1", { signal: ctrl.signal }),
          fetch("/api/settings", { cache: "no-store", signal: ctrl.signal }),
          fetch("/api/products", { cache: "no-store", signal: ctrl.signal }),
        ]);
        if (!rt.ok || !rs.ok || !rp.ok) {
          const code = !rt.ok ? rt.status : !rs.ok ? rs.status : rp.status;
          throw new Error(`La app respondio ${code}`);
        }
        const [dt, ds, dp] = (await Promise.all([rt.json(), rs.json(), rp.json()])) as [
          { templates?: StoredTemplate[] },
          { label?: { templateId?: unknown } },
          { products?: Product[] },
        ];
        if (ctrl.signal.aborted) return;
        setInitial(dt.templates ?? []);
        setActiveId(
          typeof ds.label?.templateId === "string" && ds.label.templateId !== ""
            ? ds.label.templateId
            : DEFAULT_TEMPLATE.id,
        );
        setSampleCode(dp.products?.[0]?.code ?? null);
        setState({ kind: "idle" });
      } catch (err) {
        if (!ctrl.signal.aborted) {
          setState({
            kind: "error",
            message: (err as Error).message,
          });
        }
      }
    })();
    return () => ctrl.abort();
  }, []);

  if (state.kind === "error") {
    return (
      <main className="flex flex-col gap-5">
        <PrintStatus state={state} idleText="" />
      </main>
    );
  }

  if (initial === null || activeId === null || state.kind !== "idle") {
    return (
      <main className="flex flex-col gap-5">
        <PrintStatus state={state} idleText="" />
      </main>
    );
  }

  return (
    <TemplateLibrary initial={initial} activeId={activeId} sampleCode={sampleCode} />
  );
}
