import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveQuery } from "./product.lookup.ts";
import { createInMemoryRepository } from "./product.memory.repository.ts";
import type { Product } from "./product.types.ts";

// Cases taken from the real PA PICAR catalog; see REVISION-LabelPrinter.md findings 1-3.
function product(code: string, barcode: string, name = `PRODUCT ${code}`): Product {
  return { code, name, barcode, price: 1, reference: "" };
}

const catalog: Product[] = [
  product("438", "", "INTERNAL CODE ONLY"),
  product("900", "4388", "COCINA ELECTRICA PARA CARBON"),
  product("2042", "7509546074627", "PALMOLIVE JABON HIDRATACION RADIANTE"),
  product("2048", "7509546074627", "PALMOLIVE SENSACION HUMECTANTE"),
  product("247", "4796019560234"),
  product("246", "47960195602341"),
  // Stored with a wrong EAN-13 check digit; the label prints 0400000570600.
  product("1067", "0400000570608"),
  // The source system stores "0" when a product has no barcode.
  product("3001", "0"),
  product("3002", "0"),
];

const repo = createInMemoryRepository(async () => catalog);
const codes = (products: Product[]) => products.map((p) => p.code);

test("a unique complete barcode resolves as exact", async () => {
  const r = await resolveQuery(repo, "4388");

  assert.equal(r.match, "exact");
  assert.deepEqual(codes(r.products), ["900"]);
});

test("a barcode shared by two products asks the operator to choose", async () => {
  const r = await resolveQuery(repo, "7509546074627");

  assert.equal(r.match, "ambiguous");
  assert.deepEqual(codes(r.products).sort(), ["2042", "2048"]);
});

test("a complete code that is also a barcode prefix is offered first, not dropped", async () => {
  const r = await resolveQuery(repo, "438");

  assert.equal(r.match, "ambiguous");
  assert.deepEqual(codes(r.products), ["438", "900"]);
});

test("a complete barcode that prefixes another barcode is offered first, not dropped", async () => {
  const r = await resolveQuery(repo, "4796019560234");

  assert.equal(r.match, "ambiguous");
  assert.deepEqual(codes(r.products), ["247", "246"]);
});

test("scanning a label printed with a corrected check digit finds its product", async () => {
  const r = await resolveQuery(repo, "0400000570600");

  assert.equal(r.match, "exact");
  assert.deepEqual(codes(r.products), ["1067"]);
});

test("a placeholder barcode made of zeros matches no product", async () => {
  assert.deepEqual(await repo.findAllByBarcode("0"), []);
});

test("a truncated read with no complete match is never exact", async () => {
  const r = await resolveQuery(repo, "479601956");

  assert.notEqual(r.match, "exact");
  assert.notEqual(r.match, "ambiguous");
});

test("a partial search cut at the limit says how many matched in total", async () => {
  const many = Array.from({ length: 61 }, (_, i) => product(`L${i}`, "", `LECHE ${i}`));
  const r = await resolveQuery(createInMemoryRepository(async () => many), "LECHE");

  assert.equal(r.match, "partial");
  assert.equal(r.products.length, 60);
  assert.equal(r.total, 61);
});

test("a partial search under the limit reports its real total", async () => {
  const r = await resolveQuery(repo, "PALMOLIVE");

  assert.equal(r.total, 2);
});
