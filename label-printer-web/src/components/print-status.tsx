"use client";

/**
 * Estado de la ultima operacion. `info` es un aviso que no es error ni exito.
 *
 * `ok` lleva `avisos` opcionales porque hay impresiones que salen bien y aun asi hay que
 * contarselo al operador: 337 productos del catalogo real salen SIN codigo de barras, y
 * 6 salen con el digito de control corregido. En los dos casos el papel esta en su mano y
 * el trabajo esta hecho, asi que el estado es `ok`; lo que cambia es que no se puede ir sin
 * enterarse.
 *
 * QUE CAMBIO Y POR QUE
 *
 * Antes era un cajon de color: borde de 1px y texto. Se leia bien de cerca, mal de un
 * metro, que es donde esta el operador cuando la etiqueta sale de la impresora.
 *
 * Ahora:
 *
 *   - Icono por estado. El color solo no basta para distinguir "ok" de "aviso" si alguien
 *     no ve bien el verde, y tampoco lo basta en una pantalla reflejada al sol.
 *   - Los avisos van EN el mismo cajon, no en una lista aparte de color distinto dentro.
 *     Antes un estado `ok` con avisos mostraba texto verde con una lista ambar debajo:
 *     dos mensajes que parecian contradecirse.
 *   - `aria-live="assertive"` para error y `polite` para todo lo demas. Un error de
 *     impresion tiene que interrumpir; un exito no tiene que cortar lo que se esta leyendo.
 */
export type PrintState =
  | { kind: "idle" }
  | { kind: "busy"; message: string }
  | { kind: "info"; message: string }
  | { kind: "ok"; message: string; avisos?: string[] }
  | { kind: "error"; message: string };

const TONE: Record<PrintState["kind"], string> = {
  idle: "border-line bg-surface text-ink-mute",
  busy: "border-busy-line bg-busy-soft text-brand-ink",
  info: "border-warn-line bg-warn-soft text-warn",
  ok: "border-ok-line bg-ok-soft text-ok",
  error: "border-danger-line bg-danger-soft text-danger",
};

const ICON: Record<PrintState["kind"], ReactNode> = {
  idle: <IconDot />,
  busy: <IconPulse />,
  info: <IconInfo />,
  ok: <IconCheck />,
  error: <IconAlert />,
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
  const busy = state.kind === "busy";

  return (
    <div
      role="status"
      aria-live={state.kind === "error" ? "assertive" : "polite"}
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm font-medium ${TONE[state.kind]}`}
    >
      <span aria-hidden className="mt-0.5 shrink-0">
        {ICON[state.kind]}
      </span>

      <div className="min-w-0 flex-1">
        <p className="leading-snug">{state.kind === "idle" ? idleText : state.message}</p>

        {avisos.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-ok-line pt-2 text-xs font-normal leading-relaxed">
            {avisos.map((a) => (
              <li key={a} className="flex gap-2">
                <span aria-hidden className="shrink-0 font-bold">
                  !
                </span>
                <span className="min-w-0">{a}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* Los iconos llevan su propio color heredado del cajon, para no repetirlo en 5 sitios. */

type ReactNode = React.ReactNode;

function IconDot() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 7.4v5.2M7.4 10h5.2" strokeLinecap="round" />
    </svg>
  );
}

function IconPulse() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="10" cy="10" r="7" opacity="0.35" />
      <path d="M3 10h3l1.6-3.4 2.4 6.6 1.7-3.2H17" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M10 3.2 17.4 16H2.6L10 3.2Z" strokeLinejoin="round" />
      <path d="M10 8v3.4M10 13.6v.1" strokeLinecap="round" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="10" cy="10" r="7" />
      <path d="m6.8 10.2 2.2 2.2 4.2-4.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.4v4.4M10 13.4v.1" strokeLinecap="round" />
    </svg>
  );
}
