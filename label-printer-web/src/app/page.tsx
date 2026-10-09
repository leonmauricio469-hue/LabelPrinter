"use client";

import { CentroImpresion } from "@/components/centro-impresion";

/**
 * Centro unificado de impresion (F11).
 *
 * La pagina es el `CentroImpresion`: navegacion de modos real, pills reales
 * (plantilla/cola/spool), entrada operativa con el flujo de siempre
 * (escanear -> confirmar -> IMPRIMIR), preview real y historial reciente.
 * `/fast` queda vivo por compatibilidad, sin tocar.
 */
export default function Home() {
  return <CentroImpresion />;
}
