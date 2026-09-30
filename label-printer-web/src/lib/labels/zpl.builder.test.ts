import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_TEMPLATE } from "./label.template.ts";
import { buildZpl } from "./zpl.builder.ts";
import type { LabelData } from "./label.types.ts";

function label(overrides: Partial<LabelData>): string {
  return buildZpl(DEFAULT_TEMPLATE, {
    businessName: "PA PICAR",
    productName: "CAFE",
    barcode: "7591234567890",
    price: 1.5,
    reference: "REF",
    ...overrides,
  });
}

const count = (zpl: string, cmd: string) => zpl.split(cmd).length - 1;

test("a product name cannot close the field or the label", () => {
  const zpl = label({ productName: "CAFE^FS^XZ" });

  assert.equal(count(zpl, "^XZ"), 1);
  assert.equal(count(zpl, "^XA"), 1);
  assert.ok(zpl.includes("CAFE\\5EFS\\5EXZ"), zpl);
});

test("a tilde in the data cannot become a printer command", () => {
  const zpl = label({ reference: "~JA" });

  assert.ok(!zpl.includes("~JA"), "raw ~JA would cancel every queued job");
  assert.ok(zpl.includes("\\7EJA"));
});

test("text fields decode hex escapes with a backslash indicator", () => {
  const zpl = label({ productName: "A\\B" });

  assert.ok(zpl.includes("^FH\\^FDA\\5CB^FS"), zpl);
});

test("a Code 128 barcode is sent with explicit subsets, as it was measured", () => {
  const zpl = label({ barcode: "47960195602341" });

  assert.ok(zpl.includes("^BCN,72,Y,N,N,N"), zpl);
  assert.ok(zpl.includes("^FH\\^FD>;47960195602341^FS"), zpl);
});

test("the label declares UTF-8 so accented names print as written", () => {
  const zpl = label({ productName: "AÑO ÉXITO" });

  assert.ok(zpl.startsWith("^XA\n^CI28\n"), zpl.slice(0, 40));
  assert.ok(zpl.includes("AÑO ÉXITO"));
});
