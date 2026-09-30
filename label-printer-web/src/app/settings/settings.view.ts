import { updateSettingsSchema } from "../../lib/validation/schemas";
import type { AppSettings } from "../../lib/settings/settings.types";

/** Value of the "Otra cola..." option in the queue select. */
export const OTHER_QUEUE = "__other__";

export type SettingsLoad =
  | { kind: "ready"; settings: AppSettings }
  | { kind: "error"; message: string };

/**
 * What the settings page does with the `/api/settings` response.
 *
 * Before, a failed load only set an error while `settings` stayed null, and the page
 * returned early with "Cargando configuracion..." forever: the error was never rendered.
 * Now a load is either ready or an error with the server's reason, and the body is validated
 * before the form touches `settings.printer`.
 */
export function settingsLoadResult(status: number, body: unknown): SettingsLoad {
  const reason = (body as { error?: unknown } | null)?.error;
  if (status < 200 || status >= 300) {
    return {
      kind: "error",
      message: `No se pudo leer la configuracion: ${typeof reason === "string" ? reason : `HTTP ${status}`}`,
    };
  }
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return { kind: "error", message: "La app devolvio una configuracion con un formato inesperado." };
  }
  return { kind: "ready", settings: parsed.data };
}

/**
 * How the queue name is chosen.
 *
 * Before, the saved name was always appended to the list, so even with no printers listed
 * a one-item select was rendered and the manual input was unreachable: exactly when the
 * saved name was wrong and had to be fixed. Now the input shows when there is no list, and
 * the list always ends with "Otra cola..." to switch to it.
 */
export function queueChoices(printers: string[], saved: string, otherChosen: boolean) {
  if (printers.length === 0 || otherChosen) return { manual: true, options: [] as string[] };
  const listed = printers.includes(saved) || !saved ? printers : [...printers, saved];
  return { manual: false, options: [...listed, OTHER_QUEUE] };
}
