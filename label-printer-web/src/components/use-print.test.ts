import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesMessage, printRequestId, sentMessage } from "./use-print.ts";

test("success says the labels were sent, not printed", () => {
  assert.equal(sentMessage(1), "1 etiqueta enviada a la impresora");
  assert.equal(sentMessage(3), "3 etiquetas enviadas a la impresora");
});

test("a cut list says how many are missing and asks to refine", () => {
  assert.equal(
    matchesMessage("partial", 60, 214, "LE"),
    'Se muestran 60 de 214 productos que coinciden con "LE" de forma aproximada. Escribe mas para acotar.',
  );
});

test("a complete list keeps the short message", () => {
  assert.equal(
    matchesMessage("partial", 3, 3, "LECHE"),
    '3 productos coinciden con "LECHE" de forma aproximada. Elige uno.',
  );
});

test("an ambiguous identifier says so", () => {
  assert.match(matchesMessage("ambiguous", 2, 2, "7509546074627"), /identifica a mas de un producto/);
});

test("after a lost response, printing the same thing again reuses the request id", () => {
  const lost = { key: "232|3|normal", requestId: "req-1" };

  assert.equal(printRequestId(lost, "232|3|normal", () => "req-2"), "req-1");
});

test("a different product or quantity is a new request", () => {
  const lost = { key: "232|3|normal", requestId: "req-1" };

  assert.equal(printRequestId(lost, "232|4|normal", () => "req-2"), "req-2");
  assert.equal(printRequestId(null, "232|3|normal", () => "req-3"), "req-3");
});
