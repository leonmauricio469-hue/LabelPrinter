"use client";

import { useCallback, useRef, useState } from "react";
import { ScannerInput } from "@/components/scanner-input";
import { PrintStatus } from "@/components/print-status";
import { PrinterStatusBanner } from "@/components/printer-status-banner";
import { lookupProducts, usePrint } from "@/components/use-print";
import type { Product } from "@/lib/products/product.types";

/**
 * Modo continuo ([[Modo Continuo]]): escanear -> imprimir -> listo, sin clics.
 *
 * Cantidad fija en 1 por escaneo, segun el requisito.
 *
 * **Solo imprime en coincidencia exacta.** Una coincidencia parcial no es "el producto que
 * escaneo el operador": es "productos que contienen estos caracteres". Antes, este modo
 * imprimia `products[0]` de cualquier coincidencia, asi que un escaneo leido a medias
 * imprimia la etiqueta del producto equivocado, en silencio y con el precio equivocado.
 * Aqui eso es un aviso, no una impresion. Ver `[[Prueba Coincidencias]]`.
 */
export default function FastPage() {
  const [last, setLast] = useState<Product | null>(null);
  const { state, print, notify } = usePrint();
  // Sube con cada impresion para que el estado de la impresora se vuelva a consultar: es el
  // momento en que el trabajo ya esta en la cola y su estado es informativo de verdad.
  const [refreshKey, setRefreshKey] = useState(0);

  const runningRef = useRef(false);
  const pendingRef = useRef<string | null>(null);

  const handleScan = useCallback(
    (code: string) => {
      // Un escaneo puede llegar mientras el anterior sigue yendo al spooler. En vez de
      // ignorarlo (y perder esa etiqueta) se apila y se imprime al terminar el actual.
      if (runningRef.current) {
        pendingRef.current = code;
        return;
      }
      runningRef.current = true;

      void (async () => {
        try {
          const { products, match, error } = await lookupProducts(code);

          if (error) {
            notify({ kind: "error", message: error });
          } else if (match === "exact" && products.length === 1) {
            const product = products[0];
            setLast(product);
            await print(product.code, 1, "fast");
            setRefreshKey((k) => k + 1);
          } else if (match === "partial") {
            // No se imprime nada. La coincidencia parcial necesita que alguien elija.
            notify({
              kind: "error",
              message:
                `"${code}" coincide con ${products.length} producto(s) de forma ` +
                `aproximada, no es una coincidencia exacta. Este modo solo imprime ` +
                `coincidencias exactas: usa el modo normal para elegir.`,
            });
          } else if (match === "too-short") {
            // Lectura parcial. Con los codes del catalogo real siendo "1".."3080", aceptar
            // un prefijo corto como codigo exacto imprimiria la etiqueta del producto
            // equivocado. Ver MIN_DIGITOS_CODIGO en product.lookup.ts.
            notify({
              kind: "error",
              message:
                `"${code}" es demasiado corto para ser un codigo completo. Si el ` +
                `escaner leyio el codigo a medias, vuelve a pasar el producto por el ` +
                `escaner; no se imprime nada.`,
            });
          } else {
            notify({ kind: "error", message: `Codigo "${code}" no esta en el catalogo` });
          }
        } finally {
          runningRef.current = false;
          const next = pendingRef.current;
          pendingRef.current = null;
          if (next) handleScan(next);
        }
      })();
    },
    [notify, print],
  );

  const waiting = state.kind === "idle" || state.kind === "ok" || state.kind === "info";

  return (
    <main className="flex flex-1 flex-col gap-6">
      {/* En este modo solo aparece cuando algo no anda bien: la pantalla es un cartel grande
          y con la impresora lista ese aviso solo distrae. */}
      <PrinterStatusBanner hideWhenReady refreshKey={refreshKey} />

      <ScannerInput enabled onScan={handleScan} />

      <section className="flex flex-1 flex-col items-center justify-center gap-6 rounded-lg border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold tracking-wide text-neutral-500">
          MODO IMPRESION RAPIDA
        </h2>

        {waiting ? (
          <p className="text-2xl font-bold text-neutral-900">
            ESCANEA EL PRODUCTO
            <span className="mt-3 block animate-pulse text-4xl tracking-[0.3em]">
              ████████████████
            </span>
          </p>
        ) : (
          <p className="text-2xl font-bold text-neutral-900">
            {last ? last.name : "ESCANEA EL PRODUCTO"}
            {last && (
              <span className="mt-2 block text-5xl font-black text-neutral-900">
                ${last.price.toFixed(2)}
              </span>
            )}
          </p>
        )}

        <PrintStatus
          state={state}
          idleText="Escanea el siguiente producto. Cada escaneo imprime una etiqueta."
        />
      </section>
    </main>
  );
}
