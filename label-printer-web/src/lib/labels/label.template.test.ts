import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildLabelTemplate, type LabelZone } from "./label.template.ts";
import { buildZpl } from "./zpl.builder.ts";
import type { LabelData } from "./label.types.ts";

const data = (barcode: string): LabelData => ({
  businessName: "PA PICAR",
  productName: "CAFE AMANECER DE 500GR",
  price: 7.8,
  reference: "0001",
  barcode,
});

const golden = (name: string) =>
  readFileSync(new URL(`../../../test/fixtures/label-50x25-${name}.zpl`, import.meta.url), "utf8");

// Golden files were generated from the hand-made 50 x 25 template before it became
// configurable: the default size must keep printing byte for byte the same label.
for (const [name, barcode] of [
  ["ean13", "7591234567801"],
  ["code128", "0000180"],
  ["sin-barcode", "0"],
] as const) {
  test(`50 x 25 mm still prints the original ${name} label`, () => {
    const template = buildLabelTemplate({ widthMm: 50, heightMm: 25 });

    assert.equal(buildZpl(template, data(barcode)), golden(name));
  });
}

test("a 100 x 50 mm label sets the printer to that size", () => {
  const zpl = buildZpl(buildLabelTemplate({ widthMm: 100, heightMm: 50 }), data("7591234567801"));

  assert.ok(zpl.includes("^PW800\n^LL400\n"), zpl.slice(0, 60));
});

test("the logo and the barcode stay centred on a wider label", () => {
  const zpl = buildZpl(buildLabelTemplate({ widthMm: 100, heightMm: 50 }), data("7591234567801"));

  // logo 200 dots wide, EAN-13 95 modules x 3 dots = 285
  assert.ok(zpl.includes("^FO300,"), "logo at (800 - 200) / 2");
  assert.ok(zpl.includes("^FO258,"), "barcode at (800 - 285) / 2");
});

test("an EAN-13 that does not fit a narrow label is left out instead of clipped", () => {
  // 40 mm = 320 dots: 106 modules minus 2 x 10X quiet zone = 86 < 95
  const zpl = buildZpl(buildLabelTemplate({ widthMm: 40, heightMm: 25 }), data("7591234567801"));

  assert.ok(!zpl.includes("^BE"), "a clipped EAN-13 prints fine and scans as nothing");
});

function assertInside(zones: LabelZone[], w: number, h: number, label: string) {
  for (const z of zones) {
    const right = z.kind === "text" && z.maxWidthDots ? z.x + z.maxWidthDots : z.x;
    assert.ok(z.x >= 0 && right <= w, `${label}: ${z.kind} x ${z.x}..${right} outside ${w}`);
    assert.ok(z.y >= 0 && z.y < h, `${label}: ${z.kind} y ${z.y} outside ${h}`);
  }
}

test("every zone stays inside the label for the sizes the settings accept", () => {
  for (const [widthMm, heightMm] of [[30, 20], [50, 25], [60, 40], [104, 100]]) {
    const t = buildLabelTemplate({ widthMm, heightMm });
    assertInside(t.zones, t.widthDots, t.heightDots, `${widthMm}x${heightMm}`);
    assertInside(t.zonesWithoutBarcode ?? [], t.widthDots, t.heightDots, `${widthMm}x${heightMm} sin barcode`);
  }
});

test("a label too small for the logo prints the business name instead", () => {
  const zpl = buildZpl(buildLabelTemplate({ widthMm: 40, heightMm: 20 }), {
    ...data("7591234567801"),
    businessName: "TIENDA DE PRUEBA",
  });

  assert.ok(!zpl.includes("^GFA"), "no logo on a 20 mm tall label");
  assert.ok(zpl.includes("TIENDA DE PRUEBA"), zpl);
});

test("with the logo, the business name is not printed twice", () => {
  const zpl = buildZpl(buildLabelTemplate({ widthMm: 50, heightMm: 25 }), {
    ...data("7591234567801"),
    businessName: "TIENDA DE PRUEBA",
  });

  assert.ok(!zpl.includes("TIENDA DE PRUEBA"));
});

test("every real product name fits the name zone without being cut on 50 x 25", async () => {
  const { fitText } = await import("./zpl.builder.ts");
  const catalog = JSON.parse(
    readFileSync(new URL("../../../data/catalog.json", import.meta.url), "utf8").replace(/^\uFEFF/, ""),
  ) as Array<{ code: string; name: string }>;

  const cut = catalog.filter((p) => fitText(p.name, 30, 2).endsWith("...")).map((p) => p.code);
  assert.deepEqual(cut, []);
});

test("name, barcode and reference never overlap for any size the settings accept", () => {
  // Interpretation line under an EAN-13 at 3-dot modules: about 14 dots (see label.template.ts).
  const INTERPRETATION_DOTS = 14;
  for (let widthMm = 30; widthMm <= 104; widthMm += 2) {
    for (let heightMm = 20; heightMm <= 100; heightMm += 2) {
      const t = buildLabelTemplate({ widthMm, heightMm });
      const name = t.zones.find((z) => z.kind === "text" && z.source === "productName");
      const barcode = t.zones.find((z) => z.kind === "barcode");
      const ref = t.zones.find((z) => z.kind === "text" && z.source === "reference");
      assert.ok(name?.kind === "text" && barcode?.kind === "barcode" && ref?.kind === "text");
      const lineHeight = Number(/^\^A0N,(\d+)/.exec(name.format)?.[1]);
      const nameBottom = name.y + lineHeight * (name.maxLines ?? 1);
      const barcodeBottom = barcode.y + barcode.heightDots + INTERPRETATION_DOTS;
      const at = `${widthMm}x${heightMm}`;
      assert.ok(nameBottom <= barcode.y, `${at}: name ends at ${nameBottom}, barcode starts at ${barcode.y}`);
      assert.ok(barcodeBottom <= ref.y, `${at}: barcode ends at ${barcodeBottom}, reference starts at ${ref.y}`);
    }
  }
});
