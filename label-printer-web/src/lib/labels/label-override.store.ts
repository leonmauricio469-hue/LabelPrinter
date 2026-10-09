import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
// Import RELATIVO a proposito, igual que en `validation/schemas.ts`: este archivo entra en
// `tsconfig.preview.json` por el comodin `src/lib/labels/**/*.ts`, y ese tsconfig no tiene el
// alias `@/*`. Con `@/`, el preview compila pero el `.js` emitido revienta al cargarse.
import { stripBom, describeJsonError } from "../data/json-file";
import { DEFAULT_TEMPLATE, templateById } from "./label.template";
import type { LabelTemplate, LabelZone } from "./label.template";
import { getTemplate, toLabelTemplate } from "./templates.store";

/**
 * Geometria de la etiqueta guardada desde `/editor`.
 *
 * POR QUE UN FICHERO Y NO EL CODIGO
 *
 * El boton de aplicar NO reescribe `label.template.ts`. Eso ya se documento en la pantalla del
 * editor: un POST que reescribe codigo fuente es la clase de cosa que un dia se come una
 * plantilla sin avisar. Ademas, el fichero de aqui se lee en cada impresion, asi que el cambio
 * surte efecto sin `next build`, mientras que tocar el `.ts` obligaria a recompilar y reiniciar
 * para ver un cambio de un numero.
 *
 * El codigo sigue siendo la verdad por defecto: este fichero es una capa encima, y si se borra
 * la app vuelve exactamente a `DEFAULT_TEMPLATE` sin dejar rastro. Eso convierte el boton en
 * algo reversible, que era justo lo que hacia unacceptable tocar el fuente.
 *
 * QUE SE GUARDA
 *
 * Solo las zonas, no el ancho, ni el alto, ni el nombre. El rollo lo decide el medio fisico del
 * GK420t, no un numero en una base de datos: permitir editarlo desde el editor invitaba a poner
 * 50 mm y descubrirlo en una etiqueta recortada.
 */

const DATA_DIR = path.resolve(process.cwd(), "data");
const OVERRIDE_FILE = path.join(DATA_DIR, "plantilla-override.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

export interface TemplateOverride {
  /** Para que un override de una plantilla no se aplique a otra si mañana hay una segunda. */
  templateId: string;
  zones: LabelZone[];
  zonesWithoutBarcode?: LabelZone[];
  /** Cuando se guardo, en ISO. Va en el archivo para poder decir "aplicado tal dia" sin mentir. */
  savedAt: string;
}

/**
 * Cache por fecha de modificacion, igual que el catalogo.
 *
 * Sin esto, cada impresion releeria y revalidaria el archivo. Con esto solo se relee cuando el
 * boton de aplicar lo ha tocado, que es justo cuando hace falta.
 */
let cache: { mtimeMs: number; value: TemplateOverride | null } | null = null;

/**
 * Override guardado, o `null` si no hay.
 *
 * Un archivo corrupto o de otra plantilla NO se propaga: se avisa por consola y se sigue con la
 * de codigo. Romperse el override es facil (una edicion a mano) y tumbar la ruta de impresion
 * por eso no es aceptable: el operador tiene una etiqueta que ya va a salir mal.
 */
export async function readOverride(): Promise<TemplateOverride | null> {
  let mtimeMs: number;
  let raw: string;
  try {
    mtimeMs = (await fs.stat(OVERRIDE_FILE)).mtimeMs;
    if (cache && cache.mtimeMs === mtimeMs) return cache.value;
    raw = await fs.readFile(OVERRIDE_FILE, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripBom(raw));
  } catch (err) {
    console.warn(
      `plantilla-override.json ignorado: ${describeJsonError("plantilla-override.json", raw, err)}. ` +
        `Se sigue con la plantilla del codigo.`,
    );
    cache = { mtimeMs, value: null };
    return null;
  }

  const o = parsed as Partial<TemplateOverride>;
  if (!o || typeof o.templateId !== "string" || !Array.isArray(o.zones)) {
    console.warn(
      "plantilla-override.json ignorado: no tiene la forma { templateId, zones }. " +
        "Se sigue con la plantilla del codigo.",
    );
    cache = { mtimeMs, value: null };
    return null;
  }

  const value: TemplateOverride = {
    templateId: o.templateId,
    zones: o.zones as LabelZone[],
    zonesWithoutBarcode: Array.isArray(o.zonesWithoutBarcode)
      ? (o.zonesWithoutBarcode as LabelZone[])
      : undefined,
    savedAt: typeof o.savedAt === "string" ? o.savedAt : "(desconocido)",
  };
  cache = { mtimeMs, value };
  return value;
}

/**
 * Plantilla con el override aplicado, si lo hay.
 *
 * A diferencia de `templateById()`, que es sincrona y pura (la usan el cliente y los scripts),
 * esta es asincrona porque toca disco. La usan la ruta de impresion y la de preview.
 *
 * Sin argumentos devuelve la ACTIVA (`settings.json -> label.templateId`, que es lo que la
 * pantalla de plantillas setea con "Usar"): el comportamiento actual intacto. Con
 * `templateId` resuelve esa de la biblioteca (primero el store, luego el codigo por
 * compatibilidad con ids viejos).
 *
 * LIMITE F4, A PROPOSITO: el override del editor (`plantilla-override.json`) aplica SOLO a
 * la 59x35. No se extiende a multi-plantilla: las coordenadas de un rollo no valen en el
 * de al lado, y aplicar la geometria del editor a otra plantilla seria imprimir corrido
 * sin avisar. El id se compara con el de la plantilla pedida, como antes.
 *
 * Si la pedida es raw, FALLA honestamente: el motor estructurado no cubre ZPL opaco. El
 * que imprime raw es `POST /api/labels` por su camino propio, verbatim.
 */
export async function templateForPrint(id?: string | null): Promise<LabelTemplate> {
  const wanted = id ?? (await activeTemplateId());
  const stored = await getTemplate(wanted);
  if (stored) {
    // Raw: `toLabelTemplate()` lanza con el motivo. No se devuelve nada a medias.
    const base = toLabelTemplate(stored);
    const o = await readOverride();
    if (!o || o.templateId !== base.id) return base;
    return {
      ...base,
      zones: o.zones,
      zonesWithoutBarcode: o.zonesWithoutBarcode ?? base.zonesWithoutBarcode,
    };
  }

  const base = templateById(wanted);
  const o = await readOverride();
  if (!o || o.templateId !== base.id) return base;

  return {
    ...base,
    zones: o.zones,
    zonesWithoutBarcode: o.zonesWithoutBarcode ?? base.zonesWithoutBarcode,
  };
}

/**
 * La plantilla activa, sin importar `settings.store`.
 *
 * Se lee `settings.json` aqui a mano porque ese store usa el alias `@/*`, que no existe
 * en `tsconfig.preview.json`: importarlo desde `src/lib/labels/**` romperia `npm run
 * check`. Solo se lee `label.templateId` con el mismo default que `DEFAULT_SETTINGS`;
 * el resto de settings lo sigue decidiendo su store.
 */
async function activeTemplateId(): Promise<string> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(stripBom(raw)) as { label?: { templateId?: unknown } };
    const tid = parsed.label?.templateId;
    return typeof tid === "string" && tid !== "" ? tid : DEFAULT_TEMPLATE.id;
  } catch {
    return DEFAULT_TEMPLATE.id;
  }
}

/** Si hay override, y de que plantilla. Lo usa `/settings` para no callarse un cambio. */
export async function overrideStatus(): Promise<{
  activo: boolean;
  templateId?: string;
  savedAt?: string;
  esDeEstaPlantilla: boolean;
}> {
  const o = await readOverride();
  if (!o) return { activo: false, esDeEstaPlantilla: false };
  return {
    activo: true,
    templateId: o.templateId,
    savedAt: o.savedAt,
    esDeEstaPlantilla: o.templateId === DEFAULT_TEMPLATE.id,
  };
}

/**
 * Guarda el override.
 *
 * Valida ANTES de escribir y escribe a un temporal y luego renombra. El rename en el mismo
 * volumen es atomico en Windows y en Linux, asi que un fallo a medio escribir no deja un
 * `plantilla-override.json` con la mitad del JSON, que es el estado que hace que la siguiente
 * impresion se caiga.
 */
export async function writeOverride(value: Omit<TemplateOverride, "savedAt">): Promise<void> {
  const completo: TemplateOverride = { ...value, savedAt: new Date().toISOString() };
  await fs.mkdir(DATA_DIR, { recursive: true });

  // Con `writeFile` directo, si el proceso muere a mitad, queda un JSON truncado que
  // `readOverride()` tendra que ignorar. Con temporal + rename, el archivo viejo sigue entero
  // hasta el ultimo instante.
  const tmp = `${OVERRIDE_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(completo, null, 2), "utf8");
  await fs.rename(tmp, OVERRIDE_FILE);

  // La cache se invalida a mano porque el mtime puede coincidir con el anterior dentro del
  // mismo tick en un disco con poca resolucion de reloj.
  cache = null;
}

/** Borra el override y deja la plantilla del codigo como unica verdad. */
export async function clearOverride(): Promise<void> {
  try {
    await fs.unlink(OVERRIDE_FILE);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  cache = null;
}
