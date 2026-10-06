"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buttonGhost, card } from "@/components/ui";

/**
 * El recuadro de instrucciones.
 *
 * En ambar y no en rojo: esta pagina no esta rota, esta desconectada de la impresion. Es
 * una herramienta que alguien abre a proposito, y pintarla de rojo haria parecer que algo
 * fallo justo cuando lo que se esta haciendo es diagnosticar.
 */
const calloutWarn =
  "rounded-lg border border-warn-line bg-warn-soft p-5 text-warn";

/**
 * Pagina de diagnostico del escaner ([[Escaner USB]]).
 *
 * No imprime nada y no toca el catalogo: solo muestra, tecla por tecla, lo que el
 * navegador recibe. Sirve para responder una unica pregunta: cuando el operador
 * escanea, que llega de verdad?
 *
 * Se usa cuando el modo rapido "no escanea" y no hay que adivinar si el problema es
 * que la ventana del navegador no tiene el foco, que el escaner no manda Enter, o que
 * manda un prefijo/caracter de control antes del codigo.
 */

interface Row {
  n: number;
  deltaMs: number | null;
  type: string;
  key: string;
  code: string;
  mods: string;
  target: string;
}

/** Teclas que un escaner suele mandar despues del codigo y que no son codigo. */
const TERMINATORS = new Set(["Enter", "Tab", "NumpadEnter"]);

export default function TecladoPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState(0);
  const [buffer, setBuffer] = useState("");
  const [focused, setFocused] = useState<boolean | null>(null);
  const [active, setActive] = useState<string>("(sin leer)");

  const lastRef = useRef<number | null>(null);
  const nRef = useRef(0);

  const push = useCallback(
    (type: string, ev: KeyboardEvent) => {
      const now = performance.now();
      const delta =
        lastRef.current === null ? null : Math.round(now - lastRef.current);
      lastRef.current = now;
      nRef.current += 1;
      const n = nRef.current;

      setCount(n);
      setRows((prev) =>
        [
          {
            n,
            deltaMs: delta,
            type,
            key: ev.key,
            code: ev.code,
            mods: [
              ev.ctrlKey ? "CTRL" : "",
              ev.altKey ? "ALT" : "",
              ev.shiftKey ? "SHIFT" : "",
              ev.metaKey ? "META" : "",
            ]
              .filter(Boolean)
              .join("+") || "-",
            target: (ev.target as HTMLElement | null)?.tagName ?? "?",
          },
          ...prev,
        ].slice(0, 300),
      );
    },
    [],
  );

  useEffect(() => {
    function readFocus() {
      const el = document.activeElement as HTMLElement | null;
      setFocused(document.hasFocus());
      setActive(
        el
          ? `${el.tagName}${el.id ? "#" + el.id : ""}${
              el === document.body ? " (cuerpo)" : ""
            }`
          : "(null)",
      );
    }

    function onKeyDown(ev: KeyboardEvent) {
      // Captura en `window`: corre antes que cualquier listener de la pagina.
      if (ev.key.length === 1) {
        setBuffer((b) => b + ev.key);
        push("keydown", ev);
      } else if (TERMINATORS.has(ev.key)) {
        push("TERM", ev);
        setBuffer("");
      } else {
        push("CTRL", ev);
      }
      readFocus();
    }

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("focus", readFocus, true);
    window.addEventListener("blur", readFocus, true);
    document.addEventListener("focusin", readFocus, true);
    readFocus();

    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("focus", readFocus, true);
      window.removeEventListener("blur", readFocus, true);
      document.removeEventListener("focusin", readFocus, true);
    };
  }, [push]);

  const clear = () => {
    setRows([]);
    setBuffer("");
    setCount(0);
    nRef.current = 0;
    lastRef.current = null;
  };

  return (
    <main className="flex flex-1 flex-col gap-4">
      {/*
        Aviso en ambar y no en rojo: esta pagina no esta rota, esta desconectada de la
        impresion. Pintarla de rojo haria parecer que algo fallo cuando en realidad es una
        herramienta que abre alguien a proposito.
      */}
      <section className={calloutWarn}>
        <h2 className="text-base font-bold text-warn">
          Diagnostico del escaner — no imprime nada
        </h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-warn">
          <li>
            Deja esta ventana de Chrome <strong>en primer plano</strong> (no toques el
            teclado con la mano).
          </li>
          <li>Escanea un barcode.</li>
          <li>
            Si <code className="rounded bg-surface px-1">EVENTOS: 0</code>, el problema
            es que la ventana no tiene el foco. Pasa el mouse sobre esta pagina y vuelve
            a escanear.
          </li>
          <li>
            Si hay eventos pero el{" "}
            <code className="rounded bg-surface px-1">BUFFER</code> queda vacio, el escaner
            manda un caracter de control antes del codigo.
          </li>
          <li>
            Si el buffer se llena pero no hay fila{" "}
            <code className="rounded bg-surface px-1">TERM</code>, el escaner no manda
            Enter: hay que configurar su sufijo.
          </li>
        </ol>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="EVENTOS" value={count} ok={count > 0} />
        <Stat
          label="VENTANA CON FOCO"
          value={focused === null ? "?" : focused ? "SI" : "NO"}
          ok={focused === true}
        />
        <Stat label="ACTIVO" value={active} ok />
        <Stat label="SUFIJO" value={terminatorSeen(rows) ?? "—"} ok />
      </section>

      <section className={card + " p-5"}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-ink-soft">
            BUFFER{" "}
            <span className="font-normal text-ink-mute">(caracteres acumulados)</span>
          </span>
          <button type="button" onClick={clear} className={buttonGhost}>
            Limpiar
          </button>
        </div>
        <p className="mt-3 min-h-[2.5rem] break-all font-mono text-2xl font-bold tracking-widest text-ink">
          {buffer === "" ? <span className="text-line-strong">(vacio)</span> : buffer}
        </p>
      </section>

      <section className={card + " overflow-x-auto"}>
        <table className="w-full text-left text-xs">
          <thead className="border-b border-line bg-surface-sunken text-ink-mute">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">+ms</th>
              <th className="px-3 py-2 font-medium">tipo</th>
              <th className="px-3 py-2 font-medium">key</th>
              <th className="px-3 py-2 font-medium">code</th>
              <th className="px-3 py-2 font-medium">mod</th>
              <th className="px-3 py-2 font-medium">target</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center font-sans text-ink-mute" colSpan={7}>
                  Todavia no ha llegado ninguna tecla.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.n} className="border-t border-line">
                  <td className="px-3 py-1 text-ink-mute">{r.n}</td>
                  {/* El `+ms` es el dato que importa: a mano se ve de un vistazo si los
                      caracteres llegan a velocidad de escaner o de teclado. */}
                  <td className="px-3 py-1 tabular-nums text-ink-mute">{r.deltaMs ?? "-"}</td>
                  <td
                    className={
                      r.type === "TERM"
                        ? "px-3 py-1 font-bold text-ok"
                        : r.type === "CTRL"
                          ? "px-3 py-1 font-bold text-danger"
                          : "px-3 py-1 text-ink-soft"
                    }
                  >
                    {r.type}
                  </td>
                  <td className="px-3 py-1">{JSON.stringify(r.key)}</td>
                  <td className="px-3 py-1 text-ink-mute">{r.code}</td>
                  <td className="px-3 py-1 text-ink-mute">{r.mods}</td>
                  <td className="px-3 py-1 text-ink-mute">{r.target}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function terminatorSeen(rows: Row[]): string | null {
  const t = rows.find((r) => r.type === "TERM");
  return t ? JSON.stringify(t.key) : null;
}

/**
 * Cifra de diagnostico.
 *
 * `ok` pinta de verde o de rojo, y esa es la unica codificacion por color de la pagina:
 * cada stat responde "si" o "no" a una pregunta concreta. El valor va en `font-mono` y
 * con `truncate` porque el elemento activo puede ser un `<select>` largo y no debe empujar
 * la rejilla.
 */
function Stat({
  label,
  value,
  ok,
}: {
  label: string;
  value: string | number;
  ok: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        ok ? "border-ok-line bg-ok-soft" : "border-danger-line bg-danger-soft"
      }`}
    >
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-mute">
        {label}
      </span>
      <span className="block truncate font-mono text-lg font-bold text-ink" title={String(value)}>
        {value}
      </span>
    </div>
  );
}
