"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AppNav, NAV_LINKS } from "@/components/app-nav";
import { PrinterStatusBanner } from "@/components/printer-status-banner";
import { buttonClearSecondary, displayTitle } from "@/components/ui";

/**
 * Cascaron F0 ClearCraft: TopBar + tabs + drawer, piel sin comportamiento.
 *
 * Que hay y por que:
 *
 *   - TopBar full-width (`border-edge` / `bg-panel`): marca "LabelPrinter ·
 *     PA PICAR", pill de impresora y link "Configurar" → `/settings`.
 *   - La pill es `PrinterStatusBanner` reutilizado tal cual: punto, mensaje y
 *     trabajos en cola salen de `/api/printer/status`, cero numeros
 *     inventados (sin temperaturas, sin % de ribbon, sin telemetria).
 *   - Tabs = `AppNav` tal cual, sin retocar: las rutas y el activo no cambian.
 *   - Drawer lateral con LOS MISMOS links (`NAV_LINKS`, una sola fuente: 3 desde F13).
 *     Sin grupos inventados: nada de "Colas de Impresion" ni "Registros
 *     ZPL/EPL". `/teclado` queda fuera del nav, como hoy.
 *   - F10-wide: TODAS las pantallas van a full-bleed (`max-w-none`, misma
 *     estructura del editor): la columna `max-w-3xl` dejaba oceanos de gris en
 *     los dashboards (se vio en `/` vs `/editor`). Cada pagina ordena su ancho
 *     interior como su mockup.
 *
 * Lo que NO hay a proposito: zoom global, undo/redo global, telemetria,
 * botones sin destino real.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const pathname = usePathname();

  // F10-wide: cromo y contenido siempre a `max-w-none` (misma estructura del
  // editor en todas las pantallas). `pathname` sigue usandose abajo (drawer, menu).
  const anchoCromo = "max-w-none";

  // Al navegar se cierra el drawer: el cambio de ruta ya es la confirmacion.
  useEffect(() => {
    setMenuAbierto(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuAbierto) return;
    const alTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuAbierto(false);
    };
    document.addEventListener("keydown", alTeclar);
    return () => document.removeEventListener("keydown", alTeclar);
  }, [menuAbierto]);

  return (
    <div className="flex min-h-screen flex-col bg-app">
      <header className="sticky top-0 z-40 border-b border-edge bg-panel">
        {/* Fila superior: menu, marca, configurar. */}
        <div className={`mx-auto flex w-full ${anchoCromo} items-center gap-2 px-4 pt-3 sm:px-6`}>
          <button
            type="button"
            onClick={() => setMenuAbierto(true)}
            aria-expanded={menuAbierto}
            aria-controls="menu-lateral"
            aria-label="Abrir menu de secciones"
            className="grid size-9 shrink-0 place-items-center rounded-field border border-edge bg-panel text-strong transition duration-150 hover:bg-canvas"
          >
            <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
              <path d="M2 4.5h12M2 8h12M2 11.5h12" />
            </svg>
          </button>

          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-field px-1 py-1">
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-field bg-primary text-white"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path
                  d="M4 7.5A2.5 2.5 0 0 1 6.5 5H16a2 2 0 0 1 2 2v1.2a2 2 0 0 0 0 3.6V13a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 12.5v-5Z"
                  strokeLinejoin="round"
                />
                <circle cx="7.6" cy="10" r="1.35" />
                <path d="M11 16.4v2.1M13.4 16.4v2.1M15.8 16.4v2.1" strokeLinecap="round" />
              </svg>
            </span>
            <span className={`truncate text-[15px] leading-tight ${displayTitle}`}>
              LabelPrinter · PA PICAR
            </span>
          </Link>

          <Link
            href="/settings"
            className={`${buttonClearSecondary} shrink-0 px-3 py-1.5 text-[13px]`}
          >
            Configurar
          </Link>
        </div>

        {/* Pill de impresora: estado REAL via PrinterStatusBanner. */}
        <div className={`mx-auto w-full ${anchoCromo} px-4 pt-2.5 sm:px-6`}>
          <PrinterStatusBanner />
        </div>

        {/* Tabs a las rutas existentes. */}
        <div className={`mx-auto w-full ${anchoCromo} px-4 pb-2 pt-2.5 sm:px-6`}>
          <AppNav />
        </div>
      </header>

      {/* Div y no `<main>`: cada pagina ya renderiza el suyo. El id mantiene el
          salto del enlace "Ir al contenido". */}
      <div id="contenido" className={`mx-auto flex w-full ${anchoCromo} flex-1 flex-col px-4 pb-10 pt-5 sm:px-6 sm:pt-7`}>
        {children}
      </div>

      {menuAbierto && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Cerrar menu"
            onClick={() => setMenuAbierto(false)}
            className="absolute inset-0 cursor-default bg-strong/40"
          />
          <aside
            id="menu-lateral"
            aria-label="Menu de secciones"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-pop flex-col gap-3 border-r border-edge bg-panel p-4 shadow-overlay"
          >
            <div className="flex items-center justify-between gap-2">
              <p className={`truncate text-sm ${displayTitle}`}>
                LabelPrinter · PA PICAR
              </p>
              <button
                type="button"
                onClick={() => setMenuAbierto(false)}
                aria-label="Cerrar menu"
                className="grid size-9 shrink-0 place-items-center rounded-field border border-edge bg-panel text-strong transition duration-150 hover:bg-canvas"
              >
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
                  <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
                </svg>
              </button>
            </div>

            <nav aria-label="Secciones">
              <ul className="flex flex-col gap-1">
                {NAV_LINKS.map((link) => {
                  const activo = pathname === link.href;
                  const Icon = link.icon;
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        aria-current={activo ? "page" : undefined}
                        className={[
                          "flex items-center gap-3 rounded-field px-3 py-2.5 text-sm font-medium transition duration-150",
                          activo
                            ? "bg-primary-soft text-primary"
                            : "text-strong hover:bg-canvas",
                        ].join(" ")}
                      >
                        <Icon className={activo ? "text-primary" : "text-muted"} />
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}
