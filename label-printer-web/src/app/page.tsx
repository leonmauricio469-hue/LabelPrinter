"use client";

import { useCallback, useState } from "react";
import { ScannerInput } from "@/components/scanner-input";
import { ProductCard } from "@/components/product-card";
import { QuantityStepper } from "@/components/quantity-stepper";
import { PrintStatus } from "@/components/print-status";
import { PrinterStatusBanner } from "@/components/printer-status-banner";
import { lookupProducts, usePrint } from "@/components/use-print";
import { buttonGhost, buttonPrint, card, hint, input, label } from "@/components/ui";
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
        const { products, match, error } = await lookupProducts(q);
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
        notify({
          kind: "info",
          message: `${products.length} productos coinciden con "${q}" de forma aproximada — elige uno`,
        });
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
    <main className="flex flex-col gap-5">
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

      {/*
        El campo de busqueda es el unico control que siempre esta en pantalla, asi que es
        el que define el ritmo de la pagina. Se agrando de 40px a 48px de alto y el texto
        subio a 16px por dos motivos practicos: a 15px iOS hace zoom al enfocar y la
        pantalla salta, y con el escaner mapeado a teclado el texto que "escribe" es el
        operador leyendo lo que llega, no la maquina.

        `Buscar` pasa a boton secundario, no a primario: con el escaner en la mano el
        Enter llega solo, y un boton azul compitiendo con IMPRIMIR hace que haya dos
        cosas rojas en pantalla cuando solo una gasta papel.
      */}
      <section className={card + " p-5"}>
        <label htmlFor="term" className={label}>
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
            placeholder="Escanea aqui, o escribe el codigo y pulsa Enter"
            className={`${input} h-12 flex-1 text-base`}
          />
          <button
            type="submit"
            disabled={busy || term.trim() === ""}
            className={buttonGhost + " h-12 shrink-0"}
          >
            {searching ? "Buscando..." : "Buscar"}
          </button>
        </form>
        <p className={hint}>
          El escaner USB funciona como teclado: apunta a la pagina y listo. Tambien puedes
          escribir el codigo a mano si el codigo de barras esta danado.
        </p>
      </section>

      {/*
        Coincidencias. Van ANTES del producto elegido porque el operador que llega aca todavia
        no sabe cual es el suyo: esconder la lista detras de la tarjeta del producto ya
        elegido obligaria a limpiar para volver a elegir.
      */}
      {matches.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-baseline gap-2 text-sm font-semibold text-ink-soft">
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold tabular-nums text-brand-ink">
              {matches.length}
            </span>
            Elige el producto
          </h2>
          <div className="flex flex-col gap-2">
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
          </div>
        </section>
      )}

      {selected && (
        <section className="flex flex-col gap-5 rounded-xl border-2 border-brand-ink/15 bg-surface p-5 shadow-pop">
          <ProductCard product={selected} selected />

          {/*
            La unica zona donde se gasta papel. Se separa del resto con una linea y se le
            da todo el ancho al boton: el stepper a la izquierda, la accion a la derecha,
            y el boton NO se mueve al cambiar la cantidad (min-w en `buttonPrint`).
          */}
          <div className="flex flex-wrap items-end justify-between gap-4 border-t border-line pt-4">
            <div>
              <span className={label}>Cantidad de etiquetas</span>
              <div className="mt-2">
                <QuantityStepper value={qty} onChange={setQty} disabled={busy} />
              </div>
            </div>

            <div className="flex flex-1 justify-end gap-2">
              <button
                type="button"
                onClick={clearAll}
                disabled={busy}
                className={buttonGhost}
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={doPrint}
                disabled={busy}
                className={buttonPrint}
                aria-busy={busy}
              >
                {busy ? "Imprimiendo..." : `IMPRIMIR ×${qty}`}
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
