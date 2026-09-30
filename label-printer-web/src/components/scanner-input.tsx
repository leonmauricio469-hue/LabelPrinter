"use client";

import { useEffect, useRef } from "react";

/**
 * Captura del escaner de codigo de barras USB.
 *
 * El lector es un teclado (HID): "escribe" el codigo y manda Enter. Este componente
 * escucha en `document`, no en un input, para que funcione aunque no haya nada enfocado.
 *
 * No renderiza nada: el escaner escribe "en el aire" y la UI reacciona a `onScan`.
 */

/** Si pasan estos ms sin teclear nada, el buffer se descarta. */
const IDLE_RESET_MS = 500;

export function ScannerInput({
  onScan,
  enabled = true,
}: {
  onScan: (code: string) => void;
  enabled?: boolean;
}) {
  const bufferRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Se guarda el callback en un ref para no re-registrar el listener en cada render.
  // Si el handler se recreara junto con el estado, el listener de `document` quedaria
  // apuntando a un buffer viejo y un escaneo rapido perderia caracteres.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  });

  useEffect(() => {
    if (!enabled) return;

    function reset() {
      bufferRef.current = "";
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function handleKey(event: KeyboardEvent) {
      // No secuestrar los atajos de la propia app.
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      // Si el operador esta escribiendo a mano en un campo, el escaner debe comportarse
      // como un teclado normal y ese campo es quien decide que hacer con Enter.
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (target.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
          return;
        }
      }

      if (event.key === "Enter") {
        const code = bufferRef.current.trim();
        reset();
        if (code.length > 0) {
          event.preventDefault();
          onScanRef.current(code);
        }
        return;
      }

      // Solo caracteres imprimibles: descarta flechas, F1, Shift, etc.
      if (event.key.length !== 1) return;

      bufferRef.current += event.key;

      // Cualquier tecla nueva reinicia el reloj: sirve para descartar tecleos lentos
      // que dejarian un codigo partido colgado.
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(reset, IDLE_RESET_MS);
    }

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      reset();
    };
  }, [enabled]);

  return null;
}
