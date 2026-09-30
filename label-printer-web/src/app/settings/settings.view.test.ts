import assert from "node:assert/strict";
import { test } from "node:test";
import { OTHER_QUEUE, queueChoices, settingsLoadResult } from "./settings.view.ts";
import { DEFAULT_SETTINGS } from "../../lib/settings/settings.types.ts";

test("a failed settings load becomes an error the page can show, with the server reason", () => {
  const r = settingsLoadResult(500, { error: "settings.json tiene valores invalidos (printer.transport)" });

  assert.deepEqual(r, {
    kind: "error",
    message: "No se pudo leer la configuracion: settings.json tiene valores invalidos (printer.transport)",
  });
});

test("a response that is not a settings object is an error, not a crash later", () => {
  const r = settingsLoadResult(200, { printer: null });

  assert.equal(r.kind, "error");
});

test("a valid response is ready to edit", () => {
  assert.deepEqual(settingsLoadResult(200, DEFAULT_SETTINGS), { kind: "ready", settings: DEFAULT_SETTINGS });
});

test("with no printer list the queue name is typed by hand", () => {
  assert.deepEqual(queueChoices([], "ZDesigner GX420t", false), { manual: true, options: [] });
});

test("the list always offers another queue, so a wrong saved name can be fixed", () => {
  const r = queueChoices(["Zebra A", "Zebra B"], "Zebra vieja", false);

  assert.equal(r.manual, false);
  assert.deepEqual(r.options, ["Zebra A", "Zebra B", "Zebra vieja", OTHER_QUEUE]);
});

test("choosing another queue switches to manual entry", () => {
  assert.equal(queueChoices(["Zebra A"], "Zebra A", true).manual, true);
});
