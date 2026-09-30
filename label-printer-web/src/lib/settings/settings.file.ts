import { promises as fs } from "node:fs";
import path from "node:path";
import { describeJsonError, stripBom } from "../data/json-file";
import { updateSettingsSchema } from "../validation/schemas";
import { DEFAULT_SETTINGS, type AppSettings } from "./settings.types";

/** A `settings.json` that exists but cannot be used. The message says what to fix. */
export class SettingsFileError extends Error {}

/**
 * `settings.json`, read and written safely.
 *
 * Reading: defaults are merged PER SECTION and the result is validated. Before, a spread
 * of the top level let `{ printer: { transport: "usb" } }` drop `printerName` and every
 * other printer default, and nothing was validated. A file that exists but is invalid is an
 * error with the offending field, never a silent fallback to defaults: printing to the
 * default queue because a setting was mistyped is worse than a clear message.
 *
 * Writing: to a temp file in the same directory, then `rename`, which replaces the file
 * atomically. A reader never sees a half-written file and a crash never leaves one. The
 * previous version is kept as `settings.json.bak`. Saves are queued, so two at once cannot
 * interleave.
 */
export function createSettingsFile(file: string) {
  const name = path.basename(file);
  let pending: Promise<void> = Promise.resolve();

  async function save(settings: AppSettings): Promise<void> {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(settings, null, 2), "utf8");
    try {
      await fs.copyFile(file, `${file}.bak`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    await fs.rename(tmp, file);
  }

  return {
    async read(): Promise<AppSettings> {
      let raw: string;
      try {
        raw = await fs.readFile(file, "utf8");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return DEFAULT_SETTINGS;
        throw err;
      }

      let parsed: Partial<Record<keyof AppSettings, object>>;
      try {
        parsed = JSON.parse(stripBom(raw));
      } catch (err) {
        throw new SettingsFileError(describeJsonError(name, raw, err));
      }

      const merged = {
        printer: { ...DEFAULT_SETTINGS.printer, ...parsed.printer },
        label: { ...DEFAULT_SETTINGS.label, ...parsed.label },
      };
      const result = updateSettingsSchema.safeParse(merged);
      if (!result.success) {
        const issues = result.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        throw new SettingsFileError(
          `${name} tiene valores invalidos (${issues}). Corrigelos en /settings o restaura ${name}.bak.`,
        );
      }
      return result.data;
    },

    write(settings: AppSettings): Promise<void> {
      const run = pending.then(() => save(settings));
      pending = run.catch(() => {});
      return run;
    },
  };
}
