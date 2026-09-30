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
  return { ...DEFAULT_SETTINGS, ...(JSON.parse(stripBom(raw)) as AppSettings) };
}

export async function writeSettings(settings: AppSettings): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf8");
}