"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Beeps WebAudio sin dependencias (F11).
 *
 * Dos tonos y nada mas: exito = doble agudo corto, error = grave largo. Sin
 * archivos de audio, sin librerias. El `AudioContext` se crea en la llamada
 * (gesto del operador mediante: clic o Enter), asi que no hay problema de
 * autoplay. Todo fallo se traga en silencio: el sonido es acompanamiento,
 * nunca puede tumbar una impresion.
 *
 * Los toggles (`sonidoOk`/`sonidoError` de settings) los respeta `useSonido()`;
 * aqui solo suenan frecuencias. La pagina de prueba y los toggles van en F12.
 */

function tono(frecuencia: number, inicioMs: number, duracionMs: number): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frecuencia;
    const t0 = ctx.currentTime + inicioMs / 1000;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duracionMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duracionMs / 1000 + 0.05);
    osc.onended = () => {
      void ctx.close().catch(() => undefined);
    };
  } catch {
    // Sin audio no hay impresion que salvar: se ignora.
  }
}

/** Exito: dos pitidos agudos cortos (880 -> 1320 Hz). */
export function beepOk(): void {
  tono(880, 0, 90);
  tono(1320, 110, 120);
}

/** Error: un pitido grave largo (220 Hz). */
export function beepError(): void {
  tono(220, 0, 280);
}

interface SonidoFlags {
  ok: boolean;
  error: boolean;
}

/**
 * Lee `sonidoOk`/`sonidoError` de settings una vez y devuelve funciones que
 * suenan solo si su flag esta ON. Si settings no se puede leer, suena igual
 * (los defaults son ON): quedarse mudo por un fallo de red seria el sintoma
 * al reves.
 */
export function useSonido(): { sonarOk: () => void; sonarError: () => void } {
  const flags = useRef<SonidoFlags>({ ok: true, error: true });

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!res.ok) return;
        // Los campos se llaman `sonidoOk`/`sonidoError` en settings.
        const j = (await res.json()) as {
          sonidoOk?: unknown;
          sonidoError?: unknown;
        };
        if (typeof j.sonidoOk === "boolean") flags.current.ok = j.sonidoOk;
        if (typeof j.sonidoError === "boolean")
          flags.current.error = j.sonidoError;
      } catch {
        // Defaults ON: ver doc del hook.
      }
    })();
  }, []);

  const sonarOk = useCallback(() => {
    if (flags.current.ok) beepOk();
  }, []);
  const sonarError = useCallback(() => {
    if (flags.current.error) beepError();
  }, []);

  return { sonarOk, sonarError };
}
