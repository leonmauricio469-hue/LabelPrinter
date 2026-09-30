import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_TEMPLATE } from "./label.template.ts";
import { buildZpl, fitText } from "./zpl.builder.ts";
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

test("text is wrapped by words into the lines the zone allows", () => {
  assert.equal(fitText("CAFE AMANECER DE 500GR", 30, 2), "CAFE AMANECER DE 500GR");
});

test("text that does not fit is cut explicitly instead of overprinting the last line", () => {
  const long = "SUAVIZANTE CONCENTRADO PARA ROPA AROMA LAVANDA Y FLORES SILVESTRES 2 LITROS";
  const fitted = fitText(long, 30, 2);

  assert.ok(fitted.endsWith("..."), fitted);
  assert.ok(fitted.length <= 60, `${fitted.length} chars`);
});

test("a single word longer than a line is split, not dropped", () => {
  assert.equal(fitText("A".repeat(40), 30, 2), "A".repeat(30) + " " + "A".repeat(10));
});

test("the product name gets two lines above the barcode on 50 x 25", () => {
  const zpl = label({ productName: "SUAVIZANTE CONCENTRADO PARA ROPA AROMA LAVANDA" });

  assert.ok(zpl.includes("^A0N,12,8\n^FB240,2,0,L,0"), zpl);
});
