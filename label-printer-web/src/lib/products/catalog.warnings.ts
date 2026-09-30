import { digitoCorregido } from "../labels/barcode-plan";
import type { Product } from "./product.types";

/**
 * Warning for products whose label prints a corrected EAN-13/UPC-A check digit.
 *
 * It used to check only 13-digit codes with its own rule and said "ninguna etiqueta de estos
 * productos sera legible", while the print plan corrects the digit and the label IS
 * readable. It also missed 12-digit UPC-A codes, which the plan corrects too. Now it comes
 * from the same decision the printer uses and says what is stored and what is printed, so
 * the source system can be fixed knowingly.
 */
export function checkDigitWarning(products: Product[]): { codes: string[]; message: string } | null {
  const corrected = products
    .map((p) => ({ p, impreso: digitoCorregido(p.barcode) }))
    .filter((x): x is { p: Product; impreso: string } => x.impreso !== null);
  if (corrected.length === 0) return null;

  const shown = corrected
    .slice(0, 6)
    .map(({ p, impreso }) => `${p.code} guarda "${p.barcode}", se imprime "${impreso}"`)
    .join(" | ");
  const rest = corrected.length > 6 ? ` (+${corrected.length - 6} mas)` : "";
  return {
    codes: corrected.map(({ p }) => p.code),
    message:
      `catalog.json: ${corrected.length} barcode(s) con el digito de control incorrecto. ` +
      `La etiqueta imprime el codigo corregido; corrigelo tambien en el sistema de origen ` +
      `o el codigo impreso no coincidira con el suyo: ${shown}${rest}`,
  };
}
