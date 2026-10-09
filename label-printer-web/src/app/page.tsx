"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CentroImpresion } from "@/components/centro-impresion";
import { SeccionRapido } from "@/components/seccion-rapido";
import { SeccionHistorial } from "@/components/seccion-historial";
import { SeccionPlantillas } from "@/components/seccion-plantillas";
import { SeccionLotes } from "@/components/seccion-lotes";
import { modeTabActiveClear, modeTabClear } from "@/components/ui";

/**
 * Imprimir unificada (F13): Buscar + Rapido + Historial + Plantillas + Lotes en
 * una sola pantalla. Re-composicion, cero logica nueva: cada tab es el cuerpo de
 * su pagina movido tal cual a `src/components/seccion-*.tsx`, y Buscar es el
 * `CentroImpresion` actual de `/`.
 *
 * - Deep-link con `?tab=` (default Buscar; valor desconocido = Buscar).
 * - Render perezoso: solo el tab activo esta montado. Esto ademas garantiza UNA
 *   sola instancia de `ScannerInput` (listener global de teclado: dos montados =
 *   doble impresion) — ver analisis en el handoff.
 * - `useSearchParams` va en `HubTabs` bajo `<Suspense>` (guia Next
 *   `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/
 *   use-search-params.md`: sin frontera de Suspense el build de produccion falla
 *   con `missing-suspense-with-csr-bailout`). Tabs con `<Link>` (la guia de
 *   navegacion recomienda `Link` sobre `useRouter`) y `scroll={false}` para no
 *   saltar arriba al cambiar de tab.
 *
 * `/teclado` queda como esta: herramienta de diagnostico sin link, fuera del hub.
 */

const TABS = [
  { id: "buscar", label: "Buscar", href: "/" },
  { id: "rapido", label: "Rapido", href: "/?tab=rapido" },
  { id: "historial", label: "Historial", href: "/?tab=historial" },
  { id: "plantillas", label: "Plantillas", href: "/?tab=plantillas" },
  { id: "lotes", label: "Lotes", href: "/?tab=lotes" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function tabValido(v: string | null): TabId {
  return v === "rapido" || v === "historial" || v === "plantillas" || v === "lotes"
    ? v
    : "buscar";
}

function HubTabs() {
  const searchParams = useSearchParams();
  const tab = tabValido(searchParams.get("tab"));

  return (
    <div className="flex flex-col gap-5">
      <nav
        aria-label="Secciones de impresion"
        className="flex flex-wrap items-center gap-1 rounded-card border border-edge bg-panel p-2 shadow-float"
      >
        {TABS.map((t) =>
          t.id === tab ? (
            <span key={t.id} aria-current="page" className={modeTabActiveClear}>
              {t.label}
            </span>
          ) : (
            <Link key={t.id} href={t.href} scroll={false} className={modeTabClear}>
              {t.label}
            </Link>
          ),
        )}
      </nav>

      {tab === "buscar" && <CentroImpresion />}
      {tab === "rapido" && <SeccionRapido />}
      {tab === "historial" && <SeccionHistorial />}
      {tab === "plantillas" && <SeccionPlantillas />}
      {tab === "lotes" && <SeccionLotes />}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="flex flex-col gap-5" aria-busy="true" />}>
      <HubTabs />
    </Suspense>
  );
}
