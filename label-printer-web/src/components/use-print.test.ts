import assert from "node:assert/strict";
import { test } from "node:test";
import { sentMessage } from "./use-print.ts";

test("success says the labels were sent, not printed", () => {
  assert.equal(sentMessage(1), "1 etiqueta enviada a la impresora");
  assert.equal(sentMessage(3), "3 etiquetas enviadas a la impresora");
});
