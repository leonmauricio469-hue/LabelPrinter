"use client";

import type { Product } from "@/lib/products/product.types";

/**
 * Tarjeta de producto.
 *
 * Con `onSelect` se renderiza como elemento seleccionable (lista de resultados de
 * busqueda). Sin `onSelect` es solo presentacion (el producto ya escaneado).
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
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-lg font-semibold text-neutral-900">{product.name}</span>
        <span className="shrink-0 text-2xl font-bold text-neutral-900">
          ${product.price.toFixed(2)}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
        <span>
          Ref: <span className="font-medium text-neutral-700">{product.reference}</span>
        </span>
        <span>
          Codigo:{" "}
          <span className="font-mono font-medium text-neutral-700">{product.code}</span>
        </span>
        <span>
          Barcode:{" "}
          <span className="font-mono font-medium text-neutral-700">{product.barcode}</span>
        </span>
      </div>
    </>
  );

  if (!onSelect) {
    return (
      <div
        className={`rounded-lg border bg-white p-4 shadow-sm ${
          selected ? "border-neutral-900" : "border-neutral-200"
        }`}
      >
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      className={`block w-full rounded-lg border bg-white p-4 text-left shadow-sm transition ${
        selected
          ? "border-neutral-900 ring-1 ring-neutral-900"
          : "border-neutral-200 hover:border-neutral-400"
      }`}
    >
      {body}
    </button>
  );
}
