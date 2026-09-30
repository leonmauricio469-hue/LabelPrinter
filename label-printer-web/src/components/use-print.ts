"use client";

import { useCallback, useRef, useState } from "react";
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
  /** El envio pudo haber llegado a la impresora aunque fallo (E22). */
  uncertain?: boolean;
  /** Solicitud repetida: el servidor no volvio a enviar nada. */
  duplicate?: boolean;
}

export interface LookupResult {
  products: Product[];
  /** Como los encontro el servidor. `exact` es el unico que permite imprimir sin preguntar. */
  match: MatchKind;
  /** Cuantos coincidian antes de cortar la lista. */
  total: number;
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
  const none: LookupResult = { products: [], match: "none", total: 0, error: null };
  try {
    const res = await fetch(`/api/products?q=${encodeURIComponent(q)}`);
    const data = (await res.json()) as {
      products?: Product[];
      match?: MatchKind;
      total?: number;
      error?: string;
    };
    if (!res.ok) {
      return { ...none, error: data.error ?? `La app respondio ${res.status}` };
    }
    const products = data.products ?? [];
    return { products, match: data.match ?? "none", total: data.total ?? products.length, error: null };
  } catch (err) {
    return { ...none, error: `No se pudo contactar la app: ${(err as Error).message}` };
  }
}

/**
 * El mensaje de una lista para elegir.
 *
 * `total` es cuantos coincidian antes de cortar la lista (ver `MAX_BUSQUEDA`). Si faltan
 * resultados se dice, y se pide escribir mas: antes se contaba la lista recibida y se
 * anunciaban "60 productos" aunque fueran cientos.
 */
export function matchesMessage(match: MatchKind, shown: number, total: number, q: string): string {
  if (match === "ambiguous") {
    return `"${q}" identifica a mas de un producto. Elige cual (el primero coincide entero).`;
  }
  if (total > shown) {
    return `Se muestran ${shown} de ${total} productos que coinciden con "${q}" de forma aproximada. Escribe mas para acotar.`;
  }
  return `${shown} productos coinciden con "${q}" de forma aproximada. Elige uno.`;
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

/** Una solicitud cuya respuesta no llego: pudo haberse enviado. */
export interface LostRequest {
  key: string;
  requestId: string;
}

/**
 * El id de una solicitud de impresion.
 *
 * Si la respuesta de la anterior se perdio (red, pestana, timeout del navegador) y se vuelve
 * a imprimir LO MISMO, se reutiliza su id: el servidor reconoce que ya la envio y no la
 * duplica (E22). Cualquier otra impresion es una solicitud nueva.
 */
export function printRequestId(lost: LostRequest | null, key: string, fresh: () => string): string {
  return lost && lost.key === key ? lost.requestId : fresh();
}

/**
 * Estado de impresion compartido por las dos pantallas.
 *
 * El estado vive en el cliente, no en el servidor: la app no tiene base de datos y el
 * unico que necesita saber como va la impresion es el operador que la pidio.
 */
export function usePrint() {
  const [state, setState] = useState<PrintState>({ kind: "idle" });
  const lostRef = useRef<LostRequest | null>(null);

  const notify = useCallback((next: PrintState) => setState(next), []);
  const reset = useCallback(() => setState({ kind: "idle" }), []);

  const print = useCallback(
    async (productCode: string, qty: number, mode: PrintMode): Promise<boolean> => {
      setState({
        kind: "busy",
        message: `Enviando ${qty} etiqueta${qty === 1 ? "" : "s"} a la impresora...`,
      });

      const key = `${productCode}|${qty}|${mode}`;
      const requestId = printRequestId(lostRef.current, key, () => crypto.randomUUID());

      let data: PrintResponse;
      let status: number;
      try {
        const res = await fetch("/api/labels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productCode, qty, mode, requestId }),
        });
        status = res.status;
        data = (await res.json()) as PrintResponse;
      } catch (err) {
        // La respuesta no llego: el trabajo pudo haberse enviado. Se guarda el id para que
        // volver a imprimir lo mismo no lo duplique.
        lostRef.current = { key, requestId };
        setState({
          kind: "error",
          message:
            `No llego la respuesta de la app (${(err as Error).message}): puede que la ` +
            `etiqueta ya se haya enviado. Mira la impresora; si vuelves a imprimir el mismo ` +
            `producto y cantidad, la app no lo repite.`,
        });
        return false;
      }
      lostRef.current = null;

      if (!data.ok) {
        setState({
          kind: "error",
          message: data.uncertain
            ? `${data.error ?? "Envio incierto"}. Puede que se haya impreso: revisa la ` +
              `impresora antes de volver a imprimir.`
            : (data.error ?? `La impresion fallo (HTTP ${status})`),
        });
        return false;
      }

      setState({
        kind: "ok",
        message: data.duplicate
          ? `Esa impresion ya se habia enviado: no se repitio.`
          : sentMessage(data.qty ?? qty),
        avisos: data.avisos ?? [],
      });
      return true;
    },
    [],
  );

  return { state, print, notify, reset };
}
