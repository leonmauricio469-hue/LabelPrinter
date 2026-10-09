"use client";

import { useEffect, useState } from "react";
import { DEFAULT_TEMPLATE } from "@/lib/labels/label.template";
import { cardClear } from "@/components/ui";

/**
 * Vista previa de la etiqueta del producto seleccionado.
 *
 * Pide `GET /api/labels/preview?code=...`, que rasteriza con `renderLabel()` el
 * MISMO ZPL que saldria por la impresora, y lo muestra a aspecto real
 * (472:280 dots de la 59 x 35 mm) escalado al ancho disponible. No dibuja nada
 * por su cuenta: si el endpoint cambia, la imagen cambia sola.
 *
 * Estados honestos: sin seleccion no hay imagen (una caja vacia lo dice, en vez
 * de enseñar una etiqueta falsa); cargando, esqueleto; error, el mensaje real
 * del endpoint, sin traducirlo ni adornarlo.
 */
export function ProductPreview({ code }: { code: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setUrl(null);
      setError(null);
      setCargando(false);
      return;
    }

    const ctrl = new AbortController();
    // Se trae el PNG con `fetch` y no con un `<img src>` directo para poder
    // leer el error: el endpoint responde JSON con el motivo (404, 422...), y
    // un `<img>` roto no dice por que.
    let objectUrl: string | null = null;
    setCargando(true);
    setError(null);
    setUrl(null);

    void (async () => {
      try {
        const res = await fetch(`/api/labels/preview?code=${encodeURIComponent(code)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) {
          let mensaje = `La app respondio ${res.status}`;
          try {
            const data = (await res.json()) as { error?: unknown };
            if (typeof data.error === "string" && data.error !== "") mensaje = data.error;
          } catch {
            // El cuerpo no era JSON: se queda el mensaje por defecto con el estado.
          }
          throw new Error(mensaje);
        }
        const blob = await res.blob();
        if (ctrl.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setError((err as Error).message);
      } finally {
        if (!ctrl.signal.aborted) setCargando(false);
      }
    })();

    return () => {
      ctrl.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [code]);

  // Sin producto no hay nada que previsualizar: caja vacia honesta, sin imagen.
  if (!code) {
    return (
      <div className={`${cardClear} grid place-items-center p-8`}>
        <p className="text-sm text-muted">Selecciona un producto</p>
      </div>
    );
  }

  // El marco guarda el aspecto real de la etiqueta (ancho:alto en dots) en los
  // tres estados con producto, para que la tarjeta no salte de alto al llegar
  // la imagen.
  const marco = `overflow-hidden ${cardClear}`;
  const aspecto = { aspectRatio: `${DEFAULT_TEMPLATE.widthDots} / ${DEFAULT_TEMPLATE.heightDots}` };

  if (cargando && !url && !error) {
    return (
      <div className={marco}>
        <div role="status" style={aspecto} className="grid w-full animate-pulse place-items-center bg-canvas">
          <p className="text-sm text-muted">Generando…</p>
        </div>
        <p className="border-t border-edge px-4 py-2.5 text-xs text-muted">
          Vista previa del ZPL real
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={marco}>
        <div style={aspecto} className="grid w-full place-items-center bg-canvas p-4">
          <p role="alert" className="text-center text-sm leading-relaxed text-error">
            {error}
          </p>
        </div>
        <p className="border-t border-edge px-4 py-2.5 text-xs text-muted">
          Vista previa del ZPL real
        </p>
      </div>
    );
  }

  if (!url) return null;

  return (
    <figure className={marco}>
      <img
        src={url}
        alt={`Vista previa de la etiqueta del producto ${code}`}
        style={aspecto}
        className="h-auto w-full bg-white"
      />
      <figcaption className="border-t border-edge px-4 py-2.5 text-xs text-muted">
        Vista previa del ZPL real
      </figcaption>
    </figure>
  );
}
