"use client";

/**
 * Estado de la ultima operacion. `info` es un aviso que no es error ni exito.
 *
 * `ok` lleva `avisos` opcionales porque hay impresiones que salen bien y aun asi hay que
 * contarlasle al operador: 269 productos del catalogo real salen SIN codigo de barras, y 6
 * salen con el digito de control corregido. En los dos casos el papel esta en su mano y el
 * trabajo esta hecho, asi que el estado es `ok`; lo que cambia es que no se puede ir sin
 * enterarse.
 */
export type PrintState =
  | { kind: "idle" }
  | { kind: "busy"; message: string }
  | { kind: "info"; message: string }
  | { kind: "ok"; message: string; avisos?: string[] }
  | { kind: "error"; message: string };

const STYLES: Record<PrintState["kind"], string> = {
  idle: "border-neutral-200 bg-white text-neutral-500",
  busy: "border-blue-200 bg-blue-50 text-blue-700",
  info: "border-amber-200 bg-amber-50 text-amber-800",
  ok: "border-green-200 bg-green-50 text-green-700",
  error: "border-red-200 bg-red-50 text-red-700",
};

/** Banner de estado: listo / imprimiendo / error. */
export function PrintStatus({
  state,
  idleText = "Listo.",
}: {
  state: PrintState;
  idleText?: string;
}) {
  const avisos = state.kind === "ok" ? (state.avisos ?? []) : [];
  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-md border px-4 py-3 text-sm font-medium ${STYLES[state.kind]}`}
    >
      {state.kind === "idle" ? idleText : state.message}
      {avisos.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 border-t border-green-200 pt-2 text-left text-xs font-normal text-amber-800">
          {avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
