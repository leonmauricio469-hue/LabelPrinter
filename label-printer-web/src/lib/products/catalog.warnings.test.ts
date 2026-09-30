import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { checkDigitWarning } from "./catalog.warnings.ts";
import type { Product } from "./product.types.ts";

const catalog = JSON.parse(
  readFileSync(new URL("../../../data/catalog.json", import.meta.url), "utf8").replace(/^﻿/, ""),
) as Product[];
const product = (code: string, barcode: string): Product => ({ code, name: code, barcode, price: 1, reference: "" });

test("the warning lists exactly the products the label prints with a corrected check digit", () => {
  const w = checkDigitWarning(catalog);

  // The six corrections found by the review (E03), from the same plan used to print.
  assert.deepEqual(w?.codes.sort(), ["1067", "1322", "1378", "1694", "1843", "735"].sort());
});

test("a 12-digit UPC-A with a wrong check digit is warned about too", () => {
  // 012345678905 is valid (the EAN-13 check of 0012345678905 is 5); ...906 is not, and
  // prints as 0012345678905 corrected.
  const w = checkDigitWarning([product("1", "012345678906")]);

  assert.deepEqual(w?.codes, ["1"]);
});

test("the warning says what is printed instead of calling the label unreadable", () => {
  const w = checkDigitWarning([product("1067", "0400000570608")]);

  assert.doesNotMatch(w?.message ?? "", /legible/);
  assert.match(w?.message ?? "", /1067 guarda "0400000570608", se imprime "0400000570600"/);
});

test("valid barcodes produce no warning", () => {
  assert.equal(checkDigitWarning([product("1", "7591234567801")]), null);
});
