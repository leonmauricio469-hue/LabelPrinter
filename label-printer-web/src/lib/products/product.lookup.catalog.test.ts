import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { barcodeImpreso } from "../labels/barcode-plan.ts";
import { resolveQuery } from "./product.lookup.ts";
import { createInMemoryRepository } from "./product.memory.repository.ts";
import type { Product } from "./product.types.ts";

// Round trip over the real PA PICAR catalog: print a label, scan it, get the same product.
const catalog = JSON.parse(
  readFileSync(new URL("../../../data/catalog.json", import.meta.url), "utf8").replace(/^﻿/, ""),
) as Product[];
const repo = createInMemoryRepository(async () => catalog);
const hasRealBarcode = (p: Product) => !/^(0*|null)$/i.test(p.barcode.replace(/[\s-]/g, ""));

test("every printed barcode scans back to its own product", async () => {
  const lost: string[] = [];
  const wrong: string[] = [];

  for (const p of catalog.filter(hasRealBarcode)) {
    const r = await resolveQuery(repo, barcodeImpreso(p.barcode));
    if (r.match === "exact" && r.products[0].code !== p.code) wrong.push(p.code);
    if (!r.products.some((x) => x.code === p.code)) lost.push(p.code);
  }

  assert.deepEqual(wrong, [], "scanning these printed another product without asking");
  assert.deepEqual(lost, [], "scanning these did not offer the product at all");
});

test("every internal code is offered when typed", async () => {
  const lost: string[] = [];
  for (const p of catalog) {
    const r = await resolveQuery(repo, p.code);
    if (r.match !== "exact" && r.match !== "ambiguous") lost.push(p.code);
    else if (!r.products.some((x) => x.code === p.code)) lost.push(p.code);
  }

  assert.deepEqual(lost, []);
});
