"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
      <section className="rounded-lg border border-amber-400 bg-amber-50 p-5">
        <h2 className="text-lg font-bold">Diagnostico del escaner — no imprime nada</h2>
        <ol className="mt-2 list-decimal space-y-1 text-sm text-neutral-800">
          <li>
            Deja esta ventana de Chrome <strong>en primer plano</strong> (no toques el
            teclado con la mano).
          </li>
          <li>Escanea un barcode.</li>
          <li>
            Si <code className="rounded bg-white px-1">EVENTOS: 0</code>, el problema
            es que la ventana no tiene el foco. Pasa el mouse sobre esta pagina y vuelve
            a escanear.
          </li>
          <li>
            Si hay eventos pero el <code className="rounded bg-white px-1">BUFFER</code>{" "}
            queda vacio, el escaner manda un caracter de control antes del codigo.
          </li>
          <li>
            Si el buffer se llena pero no hay fila <code className="rounded bg-white px-1">
              TERM
            </code>
            , el escaner no manda Enter: hay que configurar su sufijo.
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
        <Stat label="ELEMENTO ACTIVO" value={active} ok />
        <Stat label="ULTIMO SUFIJO" value={terminatorSeen(rows) ?? "—"} ok />
      </section>

      <section className="rounded-lg border border-neutral-300 bg-white p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-neutral-700">
            BUFFER (caracteres accumulation)
          </span>
          <button
            type="button"
            onClick={clear}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
          >
            Limpiar
          </button>
        </div>
        <p className="mt-2 break-all font-mono text-2xl font-bold tracking-widest">
          {buffer === "" ? (
            <span className="text-neutral-300">(vacio)</span>
          ) : (
            buffer
          )}
        </p>
      </section>

      <section className="rounded-lg border border-neutral-300 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-neutral-200 text-neutral-500">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">+ms</th>
              <th className="px-3 py-2">tipo</th>
              <th className="px-3 py-2">key</th>
              <th className="px-3 py-2">code</th>
              <th className="px-3 py-2">mod</th>
              <th className="px-3 py-2">target</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center font-sans text-neutral-400" colSpan={7}>
                  Todavia no ha llegado ninguna tecla.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.n} className="border-t border-neutral-100">
                  <td className="px-3 py-1 text-neutral-400">{r.n}</td>
                  <td className="px-3 py-1 text-neutral-400">{r.deltaMs ?? "-"}</td>
                  <td
                    className={
                      r.type === "TERM"
                        ? "px-3 py-1 font-bold text-green-700"
                        : r.type === "CTRL"
                          ? "px-3 py-1 font-bold text-red-600"
                          : "px-3 py-1 text-neutral-700"
                    }
                  >
                    {r.type}
                  </td>
                  <td className="px-3 py-1">{JSON.stringify(r.key)}</td>
                  <td className="px-3 py-1 text-neutral-500">{r.code}</td>
                  <td className="px-3 py-1 text-neutral-500">{r.mods}</td>
                  <td className="px-3 py-1 text-neutral-500">{r.target}</td>
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
        ok ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"
      }`}
    >
      <span className="block text-[11px] font-semibold tracking-wide text-neutral-600">
        {label}
      </span>
      <span className="block truncate font-mono text-lg font-bold text-neutral-900">
        {value}
      </span>
    </div>
  );
}
