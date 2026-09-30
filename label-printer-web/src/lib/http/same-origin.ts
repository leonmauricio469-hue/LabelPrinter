/**
 * Rejects requests that did not come from the app itself.
 *
 * The app listens only on 127.0.0.1 (E20), but any web page open in the workstation's
 * browser can still send requests to 127.0.0.1: a plain HTML form with
 * `enctype="text/plain"` posts without a CORS preflight, and `req.json()` parses its body
 * anyway. Without this check, visiting a hostile page could print up to 999 labels or
 * repoint the printer (review finding R1-002).
 *
 * - A body must be `application/json`: a cross-site form cannot send that content type
 *   without a preflight, and the app never answers preflights.
 * - If the browser sends `Origin`, its host must be the one the request was sent to.
 */
export function crossSiteRejection(
  req: Request,
  options: { body?: boolean } = {},
): { status: number; error: string } | null {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host") ?? new URL(req.url).host;
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = "";
    }
    if (originHost !== host) {
      return { status: 403, error: "Solicitud rechazada: no viene de esta aplicacion" };
    }
  }

  if (options.body !== false) {
    const type = req.headers.get("content-type") ?? "";
    if (!type.toLowerCase().startsWith("application/json")) {
      return { status: 415, error: "Solicitud rechazada: el cuerpo debe ser application/json" };
    }
  }
  return null;
}
