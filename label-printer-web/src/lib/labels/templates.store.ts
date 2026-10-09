import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
// Imports RELATIVOS a proposito, igual que en `label-override.store.ts`: este archivo entra
// en `tsconfig.preview.json` por el comodin `src/lib/labels/**/*.ts`, y ese tsconfig no tiene
// el alias `@/*`. Con `@/`, el preview compila pero el `.js` emitido revienta al cargarse.
import { stripBom, describeJsonError } from "../data/json-file";
import { DEFAULT_TEMPLATE } from "./label.template";
import type { LabelTemplate } from "./label.template";
import { zonesSchema } from "./label-zones.schema";

/**
 * Biblioteca multi-plantilla (F4).
 *
 * La plantilla del codigo (`DEFAULT_TEMPLATE`, 59 x 35 mm) sigue siendo la verdad por
 * defecto; este fichero es una capa encima, igual que `plantilla-override.json` es una capa
 * sobre `label.template.ts`: si `data/plantillas.json` se borra, la app vuelve exactamente
 * a la 59x35 sin dejar rastro. Eso convierte la biblioteca en algo reversible.
 *
 * Dos clases de plantilla, y no una, porque la realidad tiene dos:
 *
 * - `estructurada`: zonas (`LabelZone[]`) que el motor entiende: se construye ZPL con
 *   `buildZpl()`, hay vista previa PNG real y funciona `templateId` en `POST /api/labels`.
 * - `raw`: un ZPL opaco que se envia verbatim por el mismo transporte. El motor
 *   estructurado NO lo cubre (`templateForPrint()` falla honestamente si se le pide uno);
 *   el que lo imprime es `POST /api/labels` por su camino propio. No hay vista previa.
 *
 * Solo GX420: `dpi` es 203 en todo lo que la app crea. El campo existe porque un ZPL
 * importado puede traer otro origen, y mentir 203 en ese caso seria peor que decirlo.
 */

export const TEMPLATE_DPI_GX420 = 203;

/** Categoria de la semilla: la 59x35 actual, tal cual, sin renombrar nada. */
export const SEED_CATEGORY = "Retail & Precios";

/** Tope de un ZPL importado: por encima no es una etiqueta, es otra cosa. */
export const MAX_ZPL_BYTES = 256 * 1024;

export type TemplateKind = "estructurada" | "raw";

export interface StoredTemplate {
  id: string;
  name: string;
  category: string;
  kind: TemplateKind;
  widthMm: number;
  heightMm: number;
  dpi: number;
  zones?: LabelTemplate["zones"];
  zonesWithoutBarcode?: LabelTemplate["zonesWithoutBarcode"];
  zpl?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

const storedTemplateSchema = z
  .object({
    id: z.string().min(1).max(64),
    name: z.string().min(1).max(120),
    category: z.string().min(1).max(80),
    kind: z.enum(["estructurada", "raw"]),
    widthMm: z.number().positive().max(500),
    heightMm: z.number().positive().max(500),
    dpi: z.number().int().min(72).max(1200),
    zones: zonesSchema.optional(),
    zonesWithoutBarcode: zonesSchema.optional(),
    zpl: z.string().max(MAX_ZPL_BYTES).optional(),
    archived: z.boolean(),
    createdAt: z.string().min(1).max(64),
    updatedAt: z.string().min(1).max(64),
  })
  .superRefine((t, ctx) => {
    if (t.kind === "estructurada" && (!t.zones || t.zones.length === 0)) {
      ctx.addIssue({ code: "custom", message: "una plantilla estructurada necesita al menos una zona" });
    }
    if (t.kind === "raw" && (!t.zpl || t.zpl.trim() === "")) {
      ctx.addIssue({ code: "custom", message: "una plantilla raw necesita su ZPL" });
    }
  });

const storeFileSchema = z.object({
  version: z.literal(1),
  templates: z.array(storedTemplateSchema),
});

const DATA_DIR = path.resolve(process.cwd(), "data");
const TEMPLATES_FILE = path.join(DATA_DIR, "plantillas.json");

/** La `papicar-59x35` actual como estructurada: semilla, no copia a mano. */
function seedTemplates(): StoredTemplate[] {
  const ahora = new Date().toISOString();
  return [
    {
      id: DEFAULT_TEMPLATE.id,
      name: DEFAULT_TEMPLATE.name,
      category: SEED_CATEGORY,
      kind: "estructurada",
      widthMm: DEFAULT_TEMPLATE.widthMm,
      heightMm: DEFAULT_TEMPLATE.heightMm,
      dpi: TEMPLATE_DPI_GX420,
      zones: DEFAULT_TEMPLATE.zones,
      zonesWithoutBarcode: DEFAULT_TEMPLATE.zonesWithoutBarcode,
      archived: false,
      createdAt: ahora,
      updatedAt: ahora,
    },
  ];
}

/**
 * Cache por fecha de modificacion, igual que el override y que el catalogo.
 *
 * Sin esto, cada impresion con `templateId` releeria y revalidaria el archivo. Con esto
 * solo se relee cuando alguien toco la biblioteca, que es justo cuando hace falta.
 */
let cache: { mtimeMs: number; value: StoredTemplate[] } | null = null;

async function readAll(): Promise<StoredTemplate[]> {
  let mtimeMs: number;
  let raw: string;
  try {
    mtimeMs = (await fs.stat(TEMPLATES_FILE)).mtimeMs;
    if (cache && cache.mtimeMs === mtimeMs) return cache.value;
    raw = await fs.readFile(TEMPLATES_FILE, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      // Primera vez: se crea con la 59x35 actual como estructurada. El archivo lo crea el
      // store, nunca a mano (ver reglas de F4).
      const seed = seedTemplates();
      await writeAll(seed);
      return seed;
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripBom(raw));
  } catch (err) {
    console.warn(
      `plantillas.json ignorado: ${describeJsonError("plantillas.json", raw, err)}. ` +
        `Se sigue con la plantilla del codigo.`,
    );
    const seed = seedTemplates();
    cache = { mtimeMs, value: seed };
    return seed;
  }

  const checked = storeFileSchema.safeParse(parsed);
  if (!checked.success) {
    console.warn(
      "plantillas.json ignorado: no tiene la forma { version: 1, templates: [...] }. " +
        "Se sigue con la plantilla del codigo.",
    );
    const seed = seedTemplates();
    cache = { mtimeMs, value: seed };
    return seed;
  }

  cache = { mtimeMs, value: checked.data.templates };
  return checked.data.templates;
}

/**
 * Escribe la biblioteca entera, a un temporal y luego renombra. El rename en el mismo
 * volumen es atomico en Windows y en Linux, asi que un fallo a medio escribir no deja un
 * `plantillas.json` con la mitad del JSON. Mismo patron que `writeOverride()`.
 */
async function writeAll(templates: StoredTemplate[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${TEMPLATES_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ version: 1, templates }, null, 2), "utf8");
  await fs.rename(tmp, TEMPLATES_FILE);
  // Se invalida a mano porque el mtime puede coincidir con el anterior dentro del mismo
  // tick en un disco con poca resolucion de reloj.
  cache = null;
}

function newId(existing: StoredTemplate[]): string {
  let id = `tpl-${randomUUID().slice(0, 8)}`;
  while (existing.some((t) => t.id === id)) {
    id = `tpl-${randomUUID().slice(0, 8)}`;
  }
  return id;
}

export interface TemplateFilters {
  q?: string;
  categoria?: string;
  dpi?: number;
  incluirArchivadas?: boolean;
}

/** Lista filtrable por categoria y archivadas. Los filtros son sobre lo guardado. */
export async function listTemplates(filtros: TemplateFilters = {}): Promise<StoredTemplate[]> {
  const todas = await readAll();
  const q = (filtros.q ?? "").trim().toLowerCase();
  return todas.filter((t) => {
    if (!filtros.incluirArchivadas && t.archived) return false;
    if (filtros.categoria && t.category !== filtros.categoria) return false;
    if (filtros.dpi !== undefined && t.dpi !== filtros.dpi) return false;
    if (q !== "" && !`${t.name} ${t.id} ${t.category}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export async function getTemplate(id: string): Promise<StoredTemplate | null> {
  const todas = await readAll();
  return todas.find((t) => t.id === id) ?? null;
}

/** Categorias reales de lo guardado, para los filtros. Sin inventar ninguna. */
export async function distinctCategories(): Promise<string[]> {
  const todas = await readAll();
  return [...new Set(todas.map((t) => t.category))].sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * `StoredTemplate` estructurada a `LabelTemplate` del motor.
 *
 * Los dots salen de los mm (8 dots/mm a 203 dpi, la GX420 real), igual que en
 * `label.template.ts`: la medida se declara una vez en mm y de ahi sale todo.
 */
export function toLabelTemplate(t: StoredTemplate): LabelTemplate {
  if (t.kind !== "estructurada" || !t.zones) {
    throw new Error(
      `La plantilla "${t.name}" es ZPL directo (raw): el motor estructurado no la cubre. ` +
        `Se imprime tal cual con su ZPL, sin vista previa ni adaptacion.`,
    );
  }
  const dots = (mm: number) => Math.round(mm * 8);
  return {
    id: t.id,
    name: t.name,
    widthMm: t.widthMm,
    heightMm: t.heightMm,
    widthDots: dots(t.widthMm),
    heightDots: dots(t.heightMm),
    zones: t.zones,
    zonesWithoutBarcode: t.zonesWithoutBarcode,
  };
}

/**
 * Crea una plantilla.
 *
 * `from` es un id existente (se copian medidas y contenido) o `'blanco'` (59x35 con solo
 * el marco, estructurada: el marco sale de la 59x35 real, no de numeros escritos a mano).
 * Sin `from`, vale `'blanco'`.
 */
export async function createTemplate(input: {
  name: string;
  category?: string;
  from?: string;
}): Promise<StoredTemplate> {
  const todas = await readAll();
  const ahora = new Date().toISOString();
  const from = input.from ?? "blanco";

  let base: Omit<StoredTemplate, "id" | "name" | "category" | "archived" | "createdAt" | "updatedAt">;
  let category = input.category?.trim() || "";
  if (from === "blanco") {
    const marco = DEFAULT_TEMPLATE.zones[0];
    if (!marco || marco.kind !== "shape") {
      throw new Error("Fallo interno: la primera zona de la 59x35 ya no es el marco.");
    }
    base = {
      kind: "estructurada",
      widthMm: DEFAULT_TEMPLATE.widthMm,
      heightMm: DEFAULT_TEMPLATE.heightMm,
      dpi: TEMPLATE_DPI_GX420,
      zones: [marco],
    };
    if (category === "") category = "General";
  } else {
    const origen = todas.find((t) => t.id === from);
    if (!origen) throw new Error(`La plantilla "${from}" no existe: no hay nada que copiar.`);
    base = {
      kind: origen.kind,
      widthMm: origen.widthMm,
      heightMm: origen.heightMm,
      dpi: origen.dpi,
      ...(origen.zones ? { zones: origen.zones } : {}),
      ...(origen.zonesWithoutBarcode ? { zonesWithoutBarcode: origen.zonesWithoutBarcode } : {}),
      ...(origen.zpl ? { zpl: origen.zpl } : {}),
    };
    if (category === "") category = origen.category;
  }

  const creada: StoredTemplate = {
    id: newId(todas),
    name: input.name.trim(),
    category,
    archived: false,
    createdAt: ahora,
    updatedAt: ahora,
    ...base,
  };
  const checked = storedTemplateSchema.safeParse(creada);
  if (!checked.success) {
    throw new Error(`La plantilla nueva no valida: ${checked.error.issues[0]?.message ?? "forma invalida"}`);
  }
  await writeAll([...todas, checked.data]);
  return checked.data;
}

/** Solo nombre, categoria y archivada. Las zonas no se editan aqui (eso es F6/editor). */
export async function updateTemplate(
  id: string,
  cambios: { name?: string; category?: string; archived?: boolean },
): Promise<StoredTemplate | null> {
  const todas = await readAll();
  const i = todas.findIndex((t) => t.id === id);
  if (i < 0) return null;
  const actual = todas[i];
  const siguiente: StoredTemplate = {
    ...actual,
    ...(cambios.name !== undefined ? { name: cambios.name.trim() } : {}),
    ...(cambios.category !== undefined ? { category: cambios.category.trim() } : {}),
    ...(cambios.archived !== undefined ? { archived: cambios.archived } : {}),
    updatedAt: new Date().toISOString(),
  };
  const checked = storedTemplateSchema.safeParse(siguiente);
  if (!checked.success) {
    throw new Error(`El cambio no valida: ${checked.error.issues[0]?.message ?? "forma invalida"}`);
  }
  const copia = [...todas];
  copia[i] = checked.data;
  await writeAll(copia);
  return checked.data;
}

/** Duplica con id nuevo. El nombre lleva "(copia)" para que dos iguales no confundan. */
export async function duplicateTemplate(id: string): Promise<StoredTemplate | null> {
  const todas = await readAll();
  const origen = todas.find((t) => t.id === id);
  if (!origen) return null;
  const ahora = new Date().toISOString();
  const copia: StoredTemplate = {
    ...origen,
    id: newId(todas),
    name: `${origen.name} (copia)`,
    archived: false,
    createdAt: ahora,
    updatedAt: ahora,
  };
  await writeAll([...todas, copia]);
  return copia;
}

/**
 * Importa JSON de nuestro propio formato (lo que exporta la biblioteca).
 *
 * Acepta el envoltorio `{ format, version, template }` o el objeto de plantilla pelado.
 * Siempre con id NUEVO: reimportar una exportacion es una copia, no un reemplazo, y un
 * reemplazo silencioso por id seria la forma de perder la plantilla buena. Si el nombre
 * ya existe, lleva "(importada)".
 */
export async function importJsonTemplate(content: unknown): Promise<StoredTemplate> {
  const envuelta =
    typeof content === "object" && content !== null && "template" in content
      ? (content as { template: unknown }).template
      : content;
  const checked = storedTemplateSchema.safeParse(envuelta);
  if (!checked.success) {
    throw new Error(
      `Ese JSON no es una plantilla nuestra: ${checked.error.issues[0]?.message ?? "forma invalida"}`,
    );
  }
  const todas = await readAll();
  const ahora = new Date().toISOString();
  const nombreBase = checked.data.name.trim() || "Plantilla importada";
  const nombre = todas.some((t) => t.name === nombreBase && !t.archived)
    ? `${nombreBase} (importada)`
    : nombreBase;
  const creada: StoredTemplate = {
    ...checked.data,
    id: newId(todas),
    name: nombre,
    archived: false,
    createdAt: ahora,
    updatedAt: ahora,
  };
  await writeAll([...todas, creada]);
  return creada;
}

/**
 * Importa ZPL tal cual: plantilla raw verbatim.
 *
 * Las medidas salen del propio contenido (`^PW` ancho, `^LL` alto) cuando los trae, que
 * es dato real del ZPL y no suposicion. Si no los trae, 59x35: el rollo que hay puesto.
 */
export async function importRawZpl(input: { name?: string; content: string }): Promise<StoredTemplate> {
  const zpl = input.content;
  if (zpl.trim() === "") throw new Error("El ZPL viene vacio: no hay nada que importar.");
  if (zpl.length > MAX_ZPL_BYTES) {
    throw new Error(`El ZPL pesa mas de ${MAX_ZPL_BYTES / 1024} KB: no es una etiqueta.`);
  }
  const pw = zpl.match(/\^PW(\d+)/)?.[1];
  const ll = zpl.match(/\^LL(\d+)/)?.[1];
  const todas = await readAll();
  const ahora = new Date().toISOString();
  const creada: StoredTemplate = {
    id: newId(todas),
    name: input.name?.trim() || "ZPL importado",
    category: "General",
    kind: "raw",
    widthMm: pw ? Math.round((Number.parseInt(pw, 10) / 8) * 100) / 100 : 59,
    heightMm: ll ? Math.round((Number.parseInt(ll, 10) / 8) * 100) / 100 : 35,
    dpi: TEMPLATE_DPI_GX420,
    zpl,
    archived: false,
    createdAt: ahora,
    updatedAt: ahora,
  };
  const checked = storedTemplateSchema.safeParse(creada);
  if (!checked.success) {
    throw new Error(`El ZPL no valida: ${checked.error.issues[0]?.message ?? "forma invalida"}`);
  }
  await writeAll([...todas, checked.data]);
  return checked.data;
}
