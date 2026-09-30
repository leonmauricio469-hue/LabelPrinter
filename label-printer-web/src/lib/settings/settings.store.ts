import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { stripBom } from "@/lib/data/json-file";
import { DEFAULT_SETTINGS, type AppSettings } from "./settings.types";

const DATA_DIR = path.resolve(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

export async function readSettings(): Promise<AppSettings> {
  let raw: string;
  try {
    raw = await fs.readFile(SETTINGS_FILE, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return DEFAULT_SETTINGS;
    }
    throw err;
  }

  // Sin `stripBom`, un `settings.json` guardado por PowerShell con `-Encoding UTF8` deja toda
  // la app sin configuracion y sin explicacion. Ver `json-file.ts`.
  const guardado = JSON.parse(stripBom(raw)) as Partial<AppSettings>;

  // El merge es de DOS niveles, no plano, y esto no es cosmetico.
  //
  // Con `{ ...DEFAULT_SETTINGS, ...guardado }` el objeto `label` del archivo SUSTITUYE entero
  // al del default. Un `settings.json` guardado antes de que existiera `label.templateId`
  // vuelve con `label: { widthMm, heightMm, businessName }` y sin `templateId`, que queda
  // `undefined`. La pagina de configuracion entonces muestra el selector de plantilla sin
  // nada elegido, y `templateById(undefined)` cae en la de 50 mm sin decir nada.
  //
  // Un merge plano hace que cada campo nuevo que se añada a `LabelSettings` desaparezca en
  // silencio en cuanto exista un `settings.json` viejo. Que es exactamente lo que pasó al
  // añadir `templateId`.
  return {
    ...DEFAULT_SETTINGS,
    ...guardado,
    printer: { ...DEFAULT_SETTINGS.printer, ...guardado.printer },
    label: { ...DEFAULT_SETTINGS.label, ...guardado.label },
  };
}

export async function writeSettings(settings: AppSettings): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf8");
}