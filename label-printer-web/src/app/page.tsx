"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CentroImpresion, type ModoImpresion } from "@/components/centro-impresion";

/**
 * Imprimir EXACTA al mockup (F14): una sola pantalla, sin barra de tabs
 * interna. Los modos (Busqueda/Rapido/Lotes) son in-place con montaje
 * excluyente dentro de `CentroImpresion`, la biblioteca vive en la pill
 * PLANTILLA ACTIVA y el historial completo en un desplegable.
 *
 * `?tab=` solo fija el estado INICIAL (deep-link de compatibilidad: el
 * editor enlaza a `/?tab=plantillas` y nada fuera de las superficies F14
 * puede cambiarse para actualizarlo). No hay navegacion entre modos: valor
 * desconocido o ausente = Busqueda, como en F13. `useSearchParams` va bajo
 * `<Suspense>` (guia Next `node_modules/next/dist/docs/01-app/
 * 03-api-reference/04-functions/use-search-params.md`: sin frontera de
 * Suspense el build de produccion falla con
 * `missing-suspense-with-csr-bailout`).
 *
 * `/teclado` queda como esta: herramienta de diagnostico sin link, fuera
 * de la pantalla (solo enlazada desde el modal de Soporte).
 */

function estadoInicial(tab: string | null): {
  modo: ModoImpresion;
  biblio: boolean;
  historial: boolean;
} {
  if (tab === "rapido") return { modo: "rapido", biblio: false, historial: false };
  if (tab === "lotes") return { modo: "lotes", biblio: false, historial: false };
  if (tab === "plantillas") return { modo: "busqueda", biblio: true, historial: false };
  if (tab === "historial") return { modo: "busqueda", biblio: false, historial: true };
  return { modo: "busqueda", biblio: false, historial: false };
}

function Inicio() {
  const searchParams = useSearchParams();
  const init = estadoInicial(searchParams.get("tab"));

  return (
    <CentroImpresion
      modoInicial={init.modo}
      biblioInicial={init.biblio}
      historialInicial={init.historial}
    />
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="flex flex-col gap-5" aria-busy="true" />}>
      <Inicio />
    </Suspense>
  );
}
