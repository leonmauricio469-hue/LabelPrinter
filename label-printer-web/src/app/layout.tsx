import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppNav } from "@/components/app-nav";

export const metadata: Metadata = {
  title: "LabelPrinter — PA PICAR",
  description: "Etiquetadora para PA PICAR: escanear, buscar e imprimir en la Zebra GK420t.",
};

/**
 * El operador suele tener la pagina abierta en una pantalla de mostrador, sin barra de
 * direccion visible si el navegador esta en modo aplicacion. Fondo y color de tema fijos
 * para que la app no parpadee al recargar ni se vea negra un instante.
 */
export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
};

/**
 * Shell de la aplicacion.
 *
 * Layout en una sola columna centrada de `max-w-3xl`: las pantallas del operador son
 * horizontales y no necesitan una rejilla amplia. El que sea angosta es a proposito:
 * mantiene el escanear -> elegir -> imprimir en una tira vertical y hace que el boton
 * de imprimir este siempre cerca del producto, nunca al fondo de un viewport largo.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-app text-ink antialiased">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Ir al contenido
        </a>

        <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 pb-10 pt-5 sm:px-6 sm:pt-7">
          <header className="flex flex-col gap-3">
            <Brand />
            <AppNav />
          </header>

          {/* Div y no `<main>`: cada pagina ya renderiza el suyo. Dos `<main>` en un mismo
              arbol es HTML invalido y deja a los lectores de pantalla sin saber cual es
              el contenido principal. El id sigue saltando el header, que es lo que
              necesita el enlace de arriba. */}
          <div id="contenido" className="flex flex-1 flex-col">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}

/**
 * Marca. Icono + nombre + promesa en una linea.
 *
 * El icono es una etiqueta rasgada, no un engranaje ni una impresora generica: habla del
 * producto, no de la categoria. Inline en vez de SVG externo para que no haga un request
 * por render ni dependa de una fuente.
 */
function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand text-white shadow-pop"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75">
          {/* Cuerpo de la etiqueta. */}
          <path
            d="M4 7.5A2.5 2.5 0 0 1 6.5 5H16a2 2 0 0 1 2 2v1.2a2 2 0 0 0 0 3.6V13a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 12.5v-5Z"
            strokeLinejoin="round"
          />
          {/* Ojo de la etiqueta. */}
          <circle cx="7.6" cy="10" r="1.35" />
          {/* Barras: dos gruesas, una fina. */}
          <path d="M11 16.4v2.1M13.4 16.4v2.1M15.8 16.4v2.1" strokeLinecap="round" />
        </svg>
      </span>

      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold leading-tight tracking-tight text-ink">
          LabelPrinter
        </p>
        <p className="truncate text-xs leading-tight text-ink-mute">
          PA PICAR — escanear, imprimir, listo
        </p>
      </div>
    </div>
  );
}
