import assert from "node:assert/strict";
import { appendFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createPrintHistory } from "./audit.file.ts";

function tempHistory() {
  const file = path.join(mkdtempSync(path.join(tmpdir(), "history-")), "print-history.jsonl");
  return { file, history: createPrintHistory(file) };
}

test("a record keeps what was printed, so a later catalog change cannot rewrite it", async () => {
  const { history } = tempHistory();

  await history.append({
    code: "232",
    name: "CAFE",
    qty: 2,
    mode: "normal",
    status: "enviado",
    requestId: "req-1",
    price: 7.8,
    barcode: { symbology: "ean13", data: "7591234567801" },
    avisos: ["El codigo tiene el digito de control mal"],
    label: { widthMm: 50, heightMm: 25 },
    spoolerJobId: 42,
  });
  const [r] = await history.read();

  assert.equal(r.version, 2);
  assert.equal(r.status, "enviado");
  assert.equal(r.ok, true);
  assert.equal(r.price, 7.8);
  assert.deepEqual(r.barcode, { symbology: "ean13", data: "7591234567801" });
  assert.deepEqual(r.avisos, ["El codigo tiene el digito de control mal"]);
  assert.deepEqual(r.label, { widthMm: 50, heightMm: 25 });
  assert.equal(r.requestId, "req-1");
  assert.equal(r.spoolerJobId, 42);
  assert.notEqual(r.jobId, "req-1", "audit id, request id and spooler id stay separate");
});

test("an uncertain send is recorded as uncertain, not as a plain failure", async () => {
  const { history } = tempHistory();

  await history.append({ code: "232", name: "CAFE", qty: 1, mode: "fast", status: "incierto", error: "timeout" });
  const [r] = await history.read();

  assert.equal(r.status, "incierto");
  assert.equal(r.ok, false);
});

test("lines written before this format are still read, with their status derived", async () => {
  const { file, history } = tempHistory();
  appendFileSync(
    file,
    '{"ts":"2026-09-29T15:04:28.108Z","jobId":"a","code":"P-0001","name":"CAFE","qty":2,"ok":true,"mode":"normal"}\n' +
      '{"ts":"2026-09-29T15:05:00.000Z","jobId":"b","code":"P-0002","name":"LECHE","qty":1,"ok":false,"mode":"fast","error":"x"}\n',
  );

  const [newest, oldest] = await history.read();
  assert.equal(oldest.status, "enviado");
  assert.equal(newest.status, "fallido");
  assert.equal(newest.version, 1);
});

test("a corrupt line does not hide the rest of the history", async () => {
  const { file, history } = tempHistory();
  appendFileSync(file, '{"ts":"x","jobId":"a","code":"1","name":"A","qty":1,"ok":true,"mode":"normal"}\n{ broken\n');

  assert.equal((await history.read()).length, 1);
});
