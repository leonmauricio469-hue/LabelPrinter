import "server-only";
import path from "node:path";
import { createSettingsFile } from "./settings.file";
import type { AppSettings } from "./settings.types";

const SETTINGS_FILE = path.join(path.resolve(process.cwd(), "data"), "settings.json");

// Una sola instancia: la cola de guardados de `createSettingsFile` solo serializa lo que
// pasa por el mismo objeto. Ver settings.file.ts.
const settingsFile = createSettingsFile(SETTINGS_FILE);

export function readSettings(): Promise<AppSettings> {
  return settingsFile.read();
}

export function writeSettings(settings: AppSettings): Promise<void> {
  return settingsFile.write(settings);
}
