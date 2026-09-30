"use client";

import { useCallback, useState } from "react";
import type { Product } from "@/lib/products/product.types";
import type { MatchKind } from "@/lib/products/product.lookup";
import type { PrintState } from "./print-status";

/** Espejo de `PrintMode` en `lib/audit/audit.store.ts`. Se redeclara aqui porque ese
 *  archivo es `server-only` y esta es la copia que necesita el cliente. */
export type PrintMode = "normal" | "fast";

interface PrintResponse {
  ok?: boolean;
  error?: string;
  printedAt?: string;
  jobId?: string;
  qty?: number;
  product?: Product;
  /** Cosas que salieron bien pero que el operador tiene que saber. Ver `print-status.tsx`. */
  avisos?: string[];
  barcode?: { symbology: "ean13" | "code128"; data: string; modules: number } | null;
}

export interface LookupResult {
  products: Product[];
  /** Como los encontro el servidor. `exact` es el unico que permite imprimir sin preguntar. */
  match: MatchKind;
  error: string | null;
}

/**
 * Busca un producto. Un 404 no es error: es "no encontrado".
 *
 * Devuelve tambien `match` porque la lista sola no basta para decidir: un unico elemento
 * puede ser una coincidencia exacta o el unico producto que coincide por subcadena, y en
 * el segundo caso imprimirlo es imprimir una suposicion.
 */
export async function lookupProducts(q: string): Promise<LookupResult> {
  const none: LookupResult = { products: [], match: "none", error: null };
  try {
    const res = await fetch(`/api/products?q=${encodeURIComponent(q)}`);
    const data = (await res.json()) as {
      products?: Product[];
      match?: MatchKind;
      error?: string;
    };
    if (!res.ok) {
      return { ...none, error: data.error ?? `La app respondio ${res.status}` };
    }
    return { products: data.products ?? [], match: data.match ?? "none", error: null };
  } catch (err) {
    return { ...none, error: `No se pudo contactar la app: ${(err as Error).message}` };
  }
}

/**
 * Lo que se sabe de verdad cuando `/api/labels` responde ok: que la impresora o la cola de
 * Windows recibio el trabajo. Que el papel haya salido no: puede faltar papel o cinta, o la
 * cola estar en pausa. Antes decia "impresa" y un fallo fisico parecia imposible.
 */
export function sentMessage(qty: number): string {
  return qty === 1
    ? "1 etiqueta enviada a la impresora"
    : `${qty} etiquetas enviadas a la impresora`;
}

/**
 * Estado de impresion compartido por las dos pantallas.
 *
 * El estado vive en el cliente, no en el servidor: la app no tiene base de datos y el
 * unico que necesita saber como va la impresion es el operador que la pidio.
 */
export function usePrint() {
  const [state, setState] = useState<PrintState>({ kind: "idle" });

  const notify = useCallback((next: PrintState) => setState(next), []);
  const reset = useCallback(() => setState({ kind: "idle" }), []);

  const print = useCallback(
    async (productCode: string, qty: number, mode: PrintMode): Promise<boolean> => {
      setState({
        kind: "busy",
        message: `Enviando ${qty} etiqueta${qty === 1 ? "" : "s"} a la impresora...`,
      });

      try {
        const res = await fetch("/api/labels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productCode, qty, mode }),
        });
        const data = (await res.json()) as PrintResponse;

        if (!res.ok || !data.ok) {
          setState({
            kind: "error",
            message: data.error ?? `La impresion fallo (HTTP ${res.status})`,
          });
          return false;
        }

        setState({
          kind: "ok",
          message: sentMessage(data.qty ?? qty),
          avisos: data.avisos ?? [],
        });
        return true;
      } catch (err) {
        setState({
          kind: "error",
          message: `No se pudo contactar la app: ${(err as Error).message}`,
        });
        return false;
      }
    },
    [],
  );

  return { state, print, notify, reset };
}
