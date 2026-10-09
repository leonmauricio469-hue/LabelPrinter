import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

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
 * Fuentes F0 (guia Next: `node_modules/next/dist/docs/01-app/01-getting-started/
 * 13-fonts.md`): `next/font/google` auto-hospeda Inter (body) y Plus Jakarta
 * Sans (display) como `variable`, sin requests a Google en el navegador.
 *
 * Las variables apuntan a tokens que YA existen en `globals.css`: `--font-sans`
 * (cuerpo; su pila de sistema queda como fallback) y `--font-display` (nuevo
 * token F0 con su propio fallback). Sin red en build/dev, `next/font` falla al
 * buscar la fuente: el fallback documentado es quitar estas dos llamadas y
 * quedarse con las pilas de sistema, que ya estan en `@theme`.
 */
const body = Inter({ subsets: ["latin"], variable: "--font-sans" });
const display = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-display" });

/**
 * Shell de la aplicacion (F0).
 *
 * El cromo vive en `AppShell` (TopBar full-width + tabs + drawer + pill de
 * impresora real). El layout solo monta fuentes y envuelve `children`, que
 * quedan intactos: cada pagina conserva su contenido y su propio `<main>`.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${body.variable} ${display.variable}`}>
      <body className="min-h-screen bg-app text-ink antialiased">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Ir al contenido
        </a>

        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
