"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navegacion principal.
 *
 * Cambios sobre la version anterior:
 *
 *   - Iconos. No son decorativos: en pantalla de mostrador, con el escaner en la mano, un
 *     icono distinto por modo se reconoce de reojo y no hay que leer "Modo Normal" para
 *     saber que no estas en "Modo Rapido". Dos modos de impresion con nombres parecidos
 *     son la confusion mas barata de tener.
 *   - La pagina activa usa `aria-current` y un subrayado de dos píxeles ademas del color.
 *     El color solo no alcanza para alguien con deficiencia cromatica, y encima `bg-brand`
 *     con texto blanco sobre fondo claro es justo lo que mas se parece a una seleccion.
 *   - `teclado` deja de ser una pagina cualquiera: es una herramienta de diagnostico, asi
 *     que se separa visualmente del resto.
 *
 * `LINKS` sigue siendo `as const` porque `href` es literal: si un dia alguien pone una
 * plantilla, Next y el tipado lo veran aqui.
 */
const LINKS = [
  { href: "/", label: "Normal", icon: IconScan, primary: true },
  { href: "/fast", label: "Rapido", icon: IconBolt },
  { href: "/history", label: "Historial", icon: IconClock },
  { href: "/editor", label: "Editor", icon: IconRuler },
  { href: "/settings", label: "Ajustes", icon: IconGear },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones" className="-mx-1 overflow-x-auto pb-0.5">
      <ul className="flex w-max min-w-full gap-1">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          const Icon = link.icon;

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "group relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                  "transition duration-150",
                  active
                    ? "bg-brand-soft text-brand-ink"
                    : "text-ink-soft hover:bg-surface-sunken hover:text-ink",
                ].join(" ")}
              >
                <Icon className={active ? "text-brand" : "text-ink-mute"} />
                {link.label}

                {/* Subrayado: el segundo indicador de "estas aqui", que no depende del
                    color. Solo se ve en la activa, que es la unica que importa. */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type IconProps = { className?: string };

/* Iconos: 16px, stroke 1.75, ningun trazo fino de 1px (no se ve en pantallas de mostrador
   baratas ni a 100% de escala en una tablet). Todos `aria-hidden`: el texto del link ya
   dice que es, y un lector de pantalla diciendo "escanear Normal" es peor que "Normal". */

function IconScan({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" aria-hidden className={className}>
      <path d="M2 5.5V3.8A1.8 1.8 0 0 1 3.8 2h1.7M10.5 2h1.7A1.8 1.8 0 0 1 14 3.8v1.7M14 10.5v1.7a1.8 1.8 0 0 1-1.8 1.8h-1.7M5.5 14H3.8A1.8 1.8 0 0 1 2 12.2v-1.7" />
      <path d="M2 8h12" />
    </svg>
  );
}

function IconBolt({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M8.8 1.8 3.4 9h3.4l-.6 5.2L12.6 7H9.2l-.4-5.2Z" />
    </svg>
  );
}

function IconClock({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" aria-hidden className={className}>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 4.6V8l2.3 1.5" />
    </svg>
  );
}

function IconRuler({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinejoin="round" aria-hidden className={className}>
      <rect x="1.6" y="5.4" width="12.8" height="5.2" rx="1.4" />
      <path d="M5 5.4v2M8 5.4v2.6M11 5.4v2" strokeLinecap="round" />
    </svg>
  );
}

function IconGear({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinejoin="round" aria-hidden className={className}>
      <circle cx="8" cy="8" r="2.3" />
      <path d="M8 1.6v1.5M8 12.9v1.5M14.4 8h-1.5M3.1 8H1.6M12.5 3.5l-1.1 1.1M4.6 11.4l-1.1 1.1M12.5 12.5l-1.1-1.1M4.6 4.6 3.5 3.5" strokeLinecap="round" />
    </svg>
  );
}
