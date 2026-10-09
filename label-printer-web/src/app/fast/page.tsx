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

  /**
   * Tono del cartel.
   *
   * El cartel es lo unico que el operador mira en este modo: no lee, se fija. Por eso el
   * color cambia con el resultado y no es siempre gris — verde cuando salio, rojo cuando
   * no, y el gris neutro solo mientras espera. Antes el cartel era gris en las tres
   * situaciones y la unica pista del exito era la franja verde de abajo, que es texto.
   *
   * El `key` del bloque de resultado fuerza el re-montado en cada impresion para que la
   * animacion de entrada arranque de nuevo: sin eso, dos etiquetas seguidas con el mismo
   * producto no se distinguen y parece que no imprimio nada.
   */
  const signTone =
    state.kind === "error"
      ? "border-danger-line bg-danger-soft text-danger"
      : state.kind === "busy"
        ? "border-busy-line bg-busy-soft text-brand-ink"
        : state.kind === "ok"
          ? "border-ok-line bg-ok-soft text-ok"
          : "border-line bg-surface text-ink";

  return (
    <main className="flex flex-1 flex-col gap-5">
      {/* En este modo solo aparece cuando algo no anda bien: la pantalla es un cartel grande
          y con la impresora lista ese aviso solo distrae. */}
      <PrinterStatusBanner hideWhenReady refreshKey={refreshKey} />

      <ScannerInput enabled onScan={handleScan} />

      {/*
        El cartel. Ocupa lo que queda de pantalla a proposito: en este modo no hay nada mas
        que mirar, y cuanto mas grande sea el resultado menos tiene que acercarse el
        operador para confirmar que salio lo que escaneo.
      */}
      <section
        className={`flex min-h-[22rem] flex-1 flex-col items-center justify-center gap-5 rounded-xl border-2 p-8 text-center shadow-card transition-colors duration-200 ${signTone}`}
      >
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">
          Impresion rapida
        </h2>

        {state.kind === "busy" ? (
          <p className="animate-pulse text-3xl font-black uppercase tracking-wide sm:text-4xl">
            Imprimiendo...
          </p>
        ) : waiting ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-3xl font-black uppercase tracking-wide text-ink sm:text-4xl">
              Escanea el producto
            </p>
            {/* Barra de escaneo: sustituye a los bloques `█`, que eran un caracter de
                texto contando como animacion y se movian con la fuente. */}
            <div aria-hidden className="h-2 w-64 max-w-full overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full w-1/3 animate-scan rounded-full bg-brand" />
            </div>
            <p className="text-sm font-medium text-ink-mute">
              Cada escaneo imprime una etiqueta
            </p>
          </div>
        ) : (
          <div
            key={`${last?.code ?? "x"}-${state.kind}`}
            className="flex animate-pop flex-col items-center gap-3"
          >
            <p className="max-w-full text-2xl font-bold leading-tight text-ink sm:text-3xl">
              {last ? last.name : "Escanea el producto"}
            </p>
            {last && (
              <p className="text-5xl font-black tabular-nums text-ink sm:text-6xl">
                ${last.price.toFixed(2)}
              </p>
            )}
          </div>
        )}

        <PrintStatus
          state={state}
          idleText="Escanea el siguiente producto. Cada escaneo imprime una etiqueta."
        />
      </section>
    </main>
  );
}
