"use client";

import type { Product } from "@/lib/products/product.types";

/**
 * Tarjeta de producto.
 *
 * Con `onSelect` se renderiza como elemento seleccionable (lista de resultados de
 * busqueda). Sin `onSelect` es solo presentacion (el producto ya escaneado).
 *
 * QUE CAMBIO Y POR QUE
 *
 * Antes el precio iba pegado al nombre en la misma linea, separados por `justify-between`.
 * Con un nombre largo el precio quedaba a 400px del producto al que pertenece y, peor, en
 * una lista de 6 resultados los precios no formaban columna: cada uno en la x que le
 * tocaba. Escanear tres productos para comparar precios se volvia una lectura en zigzag.
 *
 * Ahora precio y nombre van en dos filas fijas. Cualquier card se puede leer entera de un
 * vistazo y, sobre todo, el precio se puede comparar bajando la vista por la columna.
 *
 * `onSelect` sigue siendo opcional: el mismo componente sirve para elegir y para mirar,
 * y no duplicar la tarjeta es lo que evita que las dos versiones se desincronicen.
 */
export function ProductCard({
  product,
  selected = false,
  onSelect,
}: {
  product: Product;
  selected?: boolean;
  onSelect?: (product: Product) => void;
}) {
  const body = (
    <>
      {/* Fila 1: identidad. El nombre manda y nunca empuja al precio fuera de la card. */}
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-base font-semibold leading-snug tracking-tight text-ink">
          {product.name}
        </span>
        <span className="shrink-0 rounded-sm bg-surface-sunken px-2 py-0.5 text-lg font-bold tabular-nums text-ink">
          ${product.price.toFixed(2)}
        </span>
      </div>

      {/* Fila 2: referencia y codigo, apretados. Son datos de apoyo, no de lectura. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-mute">
        <span>
          Ref{" "}
          <span className="font-medium text-ink-soft">{product.reference}</span>
        </span>
        <span aria-hidden className="text-line-strong">
          /
        </span>
        <span className="font-mono">
          Cod{" "}
          <span className="font-medium text-ink-soft">{product.code}</span>
        </span>
      </div>
    </>
  );

  if (!onSelect) {
    return (
      <div className="rounded-lg border border-line bg-surface p-4 shadow-card">
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      aria-pressed={selected}
      className={[
        "w-full rounded-lg border p-4 text-left shadow-card transition duration-150",
        selected
          ? "border-brand bg-brand-soft"
          : "border-line bg-surface hover:border-line-strong hover:shadow-pop",
      ].join(" ")}
    >
      {body}
    </button>
  );
}
