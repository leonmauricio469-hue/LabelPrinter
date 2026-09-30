import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createSettingsFile } from "./settings.file.ts";
import { DEFAULT_SETTINGS, type AppSettings } from "./settings.types.ts";

function tempStore() {
  const dir = mkdtempSync(path.join(tmpdir(), "settings-"));
  const file = path.join(dir, "settings.json");
  return { dir, file, store: createSettingsFile(file) };
}

const custom: AppSettings = {
  printer: { transport: "usb", host: "10.0.0.5", port: 9100, printerName: "Zebra caja 2" },
  label: { widthMm: 60, heightMm: 40, businessName: "PA PICAR" },
};

test("a missing file means the defaults", async () => {
  const { store } = tempStore();

  assert.deepEqual(await store.read(), DEFAULT_SETTINGS);
});

test("a partial file keeps the defaults of each section", async () => {
  const { file, store } = tempStore();
  writeFileSync(file, JSON.stringify({ printer: { transport: "usb" }, label: { widthMm: 60 } }));

  const s = await store.read();
  assert.equal(s.printer.transport, "usb");
  assert.equal(s.printer.printerName, DEFAULT_SETTINGS.printer.printerName);
  assert.equal(s.label.widthMm, 60);
  assert.equal(s.label.businessName, DEFAULT_SETTINGS.label.businessName);
});

test("invalid values are rejected with the field that is wrong", async () => {
  const { file, store } = tempStore();
  writeFileSync(file, JSON.stringify({ printer: { transport: "fax" } }));

  await assert.rejects(store.read(), /printer\.transport/);
});

test("a corrupt file is reported, not silently replaced by defaults", async () => {
  const { file, store } = tempStore();
  writeFileSync(file, "{ not json");

  await assert.rejects(store.read(), /settings\.json no es JSON valido/);
});

test("saving keeps the previous version as a backup and leaves no temp files", async () => {
  const { dir, file, store } = tempStore();
  await store.write(DEFAULT_SETTINGS);
  await store.write(custom);

  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), custom);
  assert.deepEqual(JSON.parse(readFileSync(`${file}.bak`, "utf8")), DEFAULT_SETTINGS);
  assert.deepEqual(readdirSync(dir).sort(), ["settings.json", "settings.json.bak"]);
});

test("concurrent saves are applied one after another, last one wins", async () => {
  const { file, store } = tempStore();
  const versions = Array.from({ length: 20 }, (_, i) => ({
    ...custom,
    label: { ...custom.label, widthMm: 30 + i },
  }));

  await Promise.all(versions.map((v) => store.write(v)));

  assert.equal(JSON.parse(readFileSync(file, "utf8")).label.widthMm, 49);
});

test("a save that fails leaves no temp file behind", async () => {
  const { dir, file, store } = tempStore();
  await store.write(DEFAULT_SETTINGS);
  // A directory where the backup should go makes the copy fail (like a locked file on Windows).
  mkdirSync(`${file}.bak`);

  await assert.rejects(store.write(custom));
  assert.deepEqual(readdirSync(dir).sort(), ["settings.json", "settings.json.bak"]);
});
