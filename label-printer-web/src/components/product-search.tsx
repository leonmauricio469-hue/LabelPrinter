"use client";

import { useEffect, useId, useRef, useState } from "react";
import { lookupProducts } from "@/components/use-print";
import { input } from "@/components/ui";
import { MAX_BUSQUEDA, MIN_BUSQUEDA } from "@/lib/products/product.lookup";
import type { Product } from "@/lib/products/product.types";

/**
 * Buscador predictivo de producto (combobox).
 *
 * Envuelve el input `#term` de la ENTRADA OPERATIVA sin cambiar el flujo que
 * ya existe: el submit del form sigue llamando al `resolve` de
 * `centro-impresion.tsx` y `ScannerInput` sigue ignorando las teclas con foco
 * en INPUT (ver `scanner-input.tsx`), asi el escan USB no hace doble resolve.
 * Elegir una sugerencia NO re-resuelve: llama `onPick` (el `setSelected`
 * existente) con el producto ya traido.
 *
 * Fuente de datos: el MISMO `lookupProducts(q)` (`GET /api/products?q=`).
 * Esa funcion no acepta `AbortSignal` y la tarea prohibe cambiarla, asi que el
 * `AbortController` de abajo es guarda de staleness: al cambiar `term` o al
 * desmontar se aborta y las respuestas tardias se descartan sin tocar estado.
 */
const DEBOUNCE_MS = 200;

interface ProductSearchProps {
  term: string;
  onTermChange: (value: string) => void;
  /** Elegir una sugerencia: el `setSelected` existente (sin re-`resolve`). */
  onPick: (product: Product) => void;
  disabled?: boolean;
}

/** Resalta la primera ocurrencia de la consulta con `<mark>` (fold simple). */
function Resaltado({ texto, consulta }: { texto: string; consulta: string }) {
  const q = consulta.trim().toLowerCase();
  if (q === "") return <>{texto}</>;
  const i = texto.toLowerCase().indexOf(q);
  if (i < 0) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, i)}
      <mark>{texto.slice(i, i + q.length)}</mark>
      {texto.slice(i + q.length)}
    </>
  );
}

export function ProductSearch({ term, onTermChange, onPick, disabled }: ProductSearchProps) {
  const [sugerencias, setSugerencias] = useState<Product[]>([]);
  const [abierta, setAbierta] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(-1);
  const listaId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  // Predictivo con debounce: solo dispara con MIN_BUSQUEDA o mas, respeta
  // MAX_BUSQUEDA en lo que muestra (el servidor ya recorta con el mismo tope).
  useEffect(() => {
    const q = term.trim();
    if (q.length < MIN_BUSQUEDA) {
      setSugerencias([]);
      setAbierta(false);
      setIndiceActivo(-1);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      void (async () => {
        const { products, error } = await lookupProducts(q);
        if (ctrl.signal.aborted) return;
        if (error || products.length === 0) {
          setSugerencias([]);
          setAbierta(false);
          setIndiceActivo(-1);
          return;
        }
        setSugerencias(products.slice(0, MAX_BUSQUEDA));
        setAbierta(true);
        setIndiceActivo(-1);
      })();
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term]);

  const elegir = (product: Product) => {
    onPick(product);
    setSugerencias([]);
    setAbierta(false);
    setIndiceActivo(-1);
    // El foco nunca se movio del input: no hay que devolverlo.
  };

  const alTeclar = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && abierta && sugerencias.length > 0) {
      e.preventDefault();
      setIndiceActivo((i) => (i + 1) % sugerencias.length);
    } else if (e.key === "ArrowUp" && abierta && sugerencias.length > 0) {
      e.preventDefault();
      setIndiceActivo((i) => (i - 1 + sugerencias.length) % sugerencias.length);
    } else if (e.key === "Enter" && abierta && indiceActivo >= 0 && sugerencias[indiceActivo]) {
      // Con sugerencia activa se elige y NO se envia el form (sin doble resolve).
      // Sin sugerencia activa el Enter cae al submit del form (`resolve`), como siempre.
      e.preventDefault();
      elegir(sugerencias[indiceActivo]);
    } else if (e.key === "Escape" && abierta) {
      e.preventDefault();
      setAbierta(false);
      setIndiceActivo(-1);
    }
  };

  const idActivo =
    abierta && indiceActivo >= 0 ? `${listaId}-opcion-${indiceActivo}` : undefined;

  return (
    <div className="relative min-w-0 flex-1">
      <input
        id="term"
        ref={inputRef}
        role="combobox"
        aria-expanded={abierta}
        aria-controls={listaId}
        aria-activedescendant={idActivo}
        aria-autocomplete="list"
        autoFocus
        autoComplete="off"
        enterKeyHint="search"
        spellCheck={false}
        value={term}
        disabled={disabled}
        onChange={(e) => onTermChange(e.target.value)}
        onKeyDown={alTeclar}
        onBlur={() => {
          // Cierra al salir sin robar foco; el click usa onMouseDown para
          // elegir antes de que el blur desmonte la lista.
          setAbierta(false);
          setIndiceActivo(-1);
        }}
        onFocus={() => {
          if (sugerencias.length > 0) setAbierta(true);
        }}
        placeholder="Escanea aqui, o escribe el codigo y pulsa Enter"
        className={`${input} h-12 text-base`}
      />
      {/* Anuncio de conteo para lector de pantalla. */}
      <p aria-live="polite" className="sr-only">
        {abierta
          ? `${sugerencias.length} sugerencia${sugerencias.length === 1 ? "" : "s"} para "${term.trim()}"`
          : ""}
      </p>
      {abierta && sugerencias.length > 0 && (
        <ul
          role="listbox"
          id={listaId}
          aria-label="Sugerencias de producto"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-md border border-edge bg-canvas shadow-lg"
        >
          {sugerencias.map((product, i) => (
            <li
              key={product.code}
              id={`${listaId}-opcion-${i}`}
              role="option"
              aria-selected={i === indiceActivo}
              onMouseDown={(e) => {
                // Evita que el mousedown mueva el foco antes del click: el
                // input sigue enfocado y el escaner no pierde su objetivo.
                e.preventDefault();
              }}
              onClick={() => elegir(product)}
              className={`flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                i === indiceActivo ? "bg-primary-soft text-primary" : "text-strong"
              }`}
            >
              <span className="min-w-0 flex-1 truncate">
                <Resaltado texto={product.name} consulta={term} />{" "}
                <span className="font-mono text-xs text-muted">
                  <Resaltado texto={product.code} consulta={term} />
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
