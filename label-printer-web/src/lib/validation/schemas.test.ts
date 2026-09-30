import assert from "node:assert/strict";
import { test } from "node:test";
import { updateSettingsSchema } from "./schemas.ts";

const settings = (widthMm: number, heightMm: number) => ({
  printer: { transport: "usb", host: "127.0.0.1", port: 9100, printerName: "ZDesigner GX420t" },
  label: { widthMm, heightMm, businessName: "PA PICAR" },
});

test("label sizes the template can lay out are accepted", () => {
  for (const [w, h] of [[30, 20], [50, 25], [104, 100]]) {
    assert.ok(updateSettingsSchema.safeParse(settings(w, h)).success, `${w} x ${h}`);
  }
});

test("a label wider than the GK420t print head is rejected", () => {
  assert.equal(updateSettingsSchema.safeParse(settings(110, 25)).success, false);
});

test("a label too small for name, price and reference is rejected", () => {
  assert.equal(updateSettingsSchema.safeParse(settings(25, 25)).success, false);
  assert.equal(updateSettingsSchema.safeParse(settings(50, 15)).success, false);
});
