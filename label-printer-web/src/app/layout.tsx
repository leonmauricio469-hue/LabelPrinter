import type { Metadata } from "next";
import "./globals.css";
import { AppNav } from "@/components/app-nav";

export const metadata: Metadata = {
  title: "LabelPrinter — PA PICAR",
  description: "Etiquetadora para PA PICAR: escanear, buscar e imprimir en la Zebra GK420t.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-neutral-100 text-neutral-900 antialiased">
        <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 p-6 sm:p-8">
          <header className="flex flex-col gap-3">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">LabelPrinter</h1>
              <p className="text-sm text-neutral-600">
                Etiquetadora PA PICAR &mdash; escanear, imprimir, listo.
              </p>
            </div>
            <AppNav />
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
