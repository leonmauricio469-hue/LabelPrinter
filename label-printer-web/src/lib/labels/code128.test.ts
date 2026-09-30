import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeCode128Auto } from "./code128.ts";

// Each Code 128 symbol is 11 modules; the stop pattern is 13.
const modulesFor = (symbols: number) => symbols * 11 + 13;

test("an even run of digits is sent with an explicit Code C start", () => {
  const r = encodeCode128Auto("47960195602341");

  assert.equal(r.fieldData, ">;47960195602341");
  // start + 7 pairs + check
  assert.equal(r.encoded.modules, modulesFor(9));
});

test("an odd run of digits switches to Code B for the last digit", () => {
  const r = encodeCode128Auto("0000180");

  assert.equal(r.fieldData, ">;000018>60");
  // start + 3 pairs + switch + 1 char + check
  assert.equal(r.encoded.modules, modulesFor(7));
});

test("letters followed by a long digit run use Code C for the digits", () => {
  const r = encodeCode128Auto("XPROD20220002");

  assert.equal(r.fieldData, ">:XPROD>520220002");
  // start + 5 chars + switch + 4 pairs + check
  assert.equal(r.encoded.modules, modulesFor(12));
});

test("short digit runs inside text stay in Code B", () => {
  const r = encodeCode128Auto("AB12CD");

  assert.equal(r.fieldData, ">:AB12CD");
  assert.equal(r.encoded.modules, modulesFor(8));
});

test("a literal > in the data is escaped so it is not read as a subset switch", () => {
  const r = encodeCode128Auto("A>B");

  assert.equal(r.fieldData, ">:A><B");
  assert.equal(r.encoded.modules, modulesFor(5));
});

test("measured widths add up to the module count", () => {
  const r = encodeCode128Auto("XPROD20220002");

  assert.equal(r.encoded.widths.reduce((a, b) => a + b, 0), r.encoded.modules);
});
