"use client";

import { useCallback, useState } from "react";
import { ScannerInput } from "@/components/scanner-input";
import { ProductCard } from "@/components/product-card";
import { QuantityStepper } from "@/components/quantity-stepper";
import { PrintStatus } from "@/components/print-status";
import { PrinterStatusBanner } from "@/components/printer-status-banner";
import { matchesMessage, lookupProducts, usePrint } from "@/components/use-print";
import { MIN_BUSQUEDA } from "@/lib/products/product.lookup";
import type { Product } from "@/lib/products/product.types";

/**
 * Modo normal ([[Flujo Principal]]): escanear, ver el producto, ajustar la cantidad,
 * imprimir. A diferencia de `/fast`, aqui el operador confirma antes de gastar papel.
 */
export default function Home() {
  const [term, setTerm] = useState("");
  const [matches, setMatches] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [searching, setSearching] = useState(false);
  const { state, print, notify, reset } = usePrint();
  // Ver `/fast`: tras cada impresion el estado de la cola ya cambio, asi que se consulta.
  const [refreshKey, setRefreshKey] = useState(0);

  const busy = searching || state.kind === "busy";

  const resolve = useCallback(
    (query: string) => {
      const q = query.trim();
      if (!q) return;

      void (async () => {
        setSearching(true);
        const { products, match, total, error } = await lookupProducts(q);
        setSearching(false);

        if (error) {
          setMatches([]);
          setSelected(null);
          notify({ kind: "error", message: error });
          return;
        }

        if (match === "too-short") {
          // No es "no existe". Con 3080 productos, dos letras devuelven cientos, asi que
          // el servidor se niega a devolver una lista que no ayuda a elegir y explica por que.
          setMatches([]);
          setSelected(null);
          notify({
            kind: "info",
            message: `Escribe al menos ${MIN_BUSQUEDA} caracteres, o escanea el codigo de barras`,
          });
          return;
        }

        if (match === "none" || products.length === 0) {
          setMatches([]);
          setSelected(null);
          notify({
            kind: "error",
            message: `Codigo "${q}" no esta en el catalogo`,
          });
          return;
        }

        // Solo una coincidencia EXACTA se acepta sin preguntar. Un unico resultado
        // aproximado sigue siendo una suposicion, y por mucho que haya uno solo en
        // pantalla, seleccionarlo seria imprimir una etiqueta que nadie confirmo.
        if (match === "exact" && products.length === 1) {
          const product = products[0];
          setMatches([]);
          setSelected(product);
          setQty(1);
          notify({ kind: "ok", message: product.name });
          return;
        }

        // Varias coincidencias, o una sola pero aproximada: el operador elige de la lista
        // en vez de adivinar.
        setMatches(products);
        setSelected(null);
        notify({ kind: "info", message: matchesMessage(match, products.length, total, q) });
      })();
    },
    [notify],
  );

  const clearAll = useCallback(() => {
    setTerm("");
    setMatches([]);
    setSelected(null);
    setQty(1);
    reset();
  }, [reset]);

  const doPrint = useCallback(async () => {
    if (!selected) return;
    const ok = await print(selected.code, qty, "normal");
    setRefreshKey((k) => k + 1);
    // Se deja el producto en pantalla: el operador suele querer repetir la tirada.
    if (ok) setQty(1);
  }, [print, qty, selected]);

  return (
    <main className="flex flex-col gap-6">
      {/* Aqui si se muestra siempre: el operador va a confirmar antes de gastar papel, asi
          que ver el estado de la impresora antes de confirmar es util. */}
      <PrinterStatusBanner refreshKey={refreshKey} />

      <ScannerInput
        enabled={!busy}
        onScan={(code) => {
          setTerm("");
          resolve(code);
        }}
      />

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <label
          htmlFor="term"
          className="text-sm font-medium text-neutral-700"
        >
          Codigo de barras o codigo de producto
        </label>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            resolve(term);
          }}
        >
          <input
            id="term"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Escanea aqui, o escribe el codigo y Enter"
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2.5 text-sm focus:border-neutral-900 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || term.trim() === ""}
            className="rounded-md border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Buscar
          </button>
        </form>
        <p className="mt-2 text-xs text-neutral-500">
          El escaner USB funciona como teclado: escanea sobre la pagina y ya esta. Tambien
          puedes escribir el codigo a mano si el barcode esta danado.
        </p>
      </section>

      {matches.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-neutral-700">
            {matches.length} coincidencias
          </h2>
          {matches.map((product) => (
            <ProductCard
              key={product.code}
              product={product}
              onSelect={() => {
                setSelected(product);
                setMatches([]);
                setQty(1);
                notify({ kind: "ok", message: product.name });
              }}
            />
          ))}
        </section>
      )}

      {selected && (
        <section className="flex flex-col gap-5 rounded-lg border border-neutral-900 bg-white p-5 shadow-sm">
          <ProductCard product={selected} selected />
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-sm font-medium text-neutral-700">
                Cantidad de etiquetas
              </span>
              <div className="mt-2">
                <QuantityStepper
                  value={qty}
                  onChange={setQty}
                  disabled={busy}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={clearAll}
                disabled={busy}
                className="rounded-md border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-100 disabled:opacity-40"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={doPrint}
                disabled={busy}
                className="rounded-md bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                IMPRIMIR
              </button>
            </div>
          </div>
        </section>
      )}

      <PrintStatus
        state={state}
        idleText="Escanea un producto para empezar. No necesitas hacer clic."
      />
    </main>
  );
}
