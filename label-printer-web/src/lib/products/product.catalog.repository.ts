import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { productSchema } from "@/lib/validation/schemas";
import { ean13Problem, isEan13Shape } from "@/lib/labels/ean13";
import { describeJsonError, stripBom } from "@/lib/data/json-file";
import type { Product } from "./product.types";
import type { ProductRepository } from "./product.repository";
import { createInMemoryRepository } from "./product.memory.repository";

const DATA_DIR = path.resolve(process.cwd(), "data");
const CATALOG_FILE = path.join(DATA_DIR, "catalog.json");

/**
 * Cache por fecha de modificacion. `catalog.json` se edita a mano (y en la fase Carro
 * desde la web), asi que se comprueba el mtime en cada lectura: si el archivo cambio se
 * recarga, y si no se devuelve la copia en memoria. Evita releer y revalidar las miles
 * de filas del catalogo en cada escaneo.
 */
let cache: { mtimeMs: number; products: Product[] } | null = null;

async function load(): Promise<Product[]> {
  let mtimeMs: number;
  let raw: string;

  try {
    mtimeMs = (await fs.stat(CATALOG_FILE)).mtimeMs;
    if (cache && cache.mtimeMs === mtimeMs) return cache.products;
    raw = await fs.readFile(CATALOG_FILE, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  let parsed: unknown;
  try {
    // Sin `stripBom`, un `catalog.json` guardado desde Windows con BOM daria "no es JSON
    // valido" sin decir por que. Ver `json-file.ts`.
    parsed = JSON.parse(stripBom(raw));
  } catch (err) {
    throw new Error(describeJsonError("catalog.json", raw, err));
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`catalog.json debe ser un arreglo de productos, recibio ${typeof parsed}`);
  }

  const products: Product[] = [];
  const problems: string[] = [];

  parsed.forEach((entry, index) => {
    const result = productSchema.safeParse(entry);
    if (result.success) {
      products.push(result.data);
      return;
    }
    const code = typeof (entry as { code?: unknown })?.code === "string"
      ? ` (code "${(entry as { code: string }).code}")`
      : "";
    problems.push(
      `fila ${index + 1}${code}: ${result.error.issues.map((i) => `${i.path.join(".") || "?"} ${i.message}`).join(", ")}`,
    );
  });

  // Falla duro y ruidoso: un catalogo con una fila mala imprimiria datos equivocados
  // en una etiqueta, que es peor que un error claro en pantalla.
  if (problems.length > 0) {
    const shown = problems.slice(0, 5).join(" | ");
    const rest = problems.length > 5 ? ` (+${problems.length - 5} mas)` : "";
    throw new Error(`catalog.json tiene ${problems.length} fila(s) invalidas: ${shown}${rest}`);
  }

  // El digito de control de un EAN-13 NO es un dato que se pueda ignorar: con el digito
  // mal la etiqueta se imprime nitida y ningun lector la decodifica, que es el peor
  // fallo posible porque no se ve. Por aqui solo se avisa: la fila es valida y puede que
  // el codigo no sea EAN-13 (Code 128 admite cualquier cosa). `POST /api/labels` si
  // rechaza el caso de uso real, que es imprimir ese barcode como EAN-13.
  const unreadable = products.filter((p) => isEan13Shape(p.barcode) && ean13Problem(p.barcode));
  if (unreadable.length > 0) {
    const shown = unreadable
      .slice(0, 5)
      .map((p) => `${p.code} "${p.barcode}" (${ean13Problem(p.barcode)})`)
      .join(" | ");
    const rest = unreadable.length > 5 ? ` (+${unreadable.length - 5} mas)` : "";
    console.warn(
      `catalog.json: ${unreadable.length} barcode(s) EAN-13 con digito de control ` +
        `incorrecto, ninguna etiqueta de estos productos sera legible: ${shown}${rest}`,
    );
  }

  cache = { mtimeMs, products };
  return products;
}

function createCatalogRepository(): ProductRepository {
  return createInMemoryRepository(load);
}

let repository: ProductRepository | null = null;

/**
 * Punto unico de acceso al catalogo. Un factory como este (y no un import directo de la
 * implementacion) es lo que permite cambiar de fuente de datos mas adelante sin tocar
 * los route handlers.
 */
export function getProductRepository(): ProductRepository {
  repository ??= createCatalogRepository();
  return repository;
}
