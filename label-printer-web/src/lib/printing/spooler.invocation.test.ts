import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSpoolerInvocation, spoolerResult, zplPayload } from "./spooler.invocation.ts";

// CreateProcess rejects command lines longer than this many characters.
const WINDOWS_COMMAND_LINE_LIMIT = 32767;

// One label for product 232 encodes to 4,812 base64 chars; the API allows 999 labels.
const maxBatchBase64 = "A".repeat(4812 * 999);

function commandLineLength(args: string[]): number {
  return ["powershell.exe", ...args].join(" ").length;
}

test("a 999-label batch keeps the command line within the Windows limit", () => {
  const { args } = buildSpoolerInvocation("ZDesigner GK420t", "Send", maxBatchBase64);

  assert.ok(
    commandLineLength(args) < WINDOWS_COMMAND_LINE_LIMIT,
    `command line is ${commandLineLength(args)} chars`,
  );
});

test("the send payload reaches the helper through stdin", () => {
  const { stdin } = buildSpoolerInvocation("ZDesigner GK420t", "Send", maxBatchBase64);

  assert.ok(stdin === maxBatchBase64, `stdin carries ${stdin.length} chars`);
});

test("the USB payload is UTF-8, matching the ^CI28 the label declares", () => {
  const bytes = Buffer.from(zplPayload("Ñ"), "base64");

  assert.deepEqual([...bytes], [0xc3, 0x91]);
});

test("a delivered job carries the Windows spooler job id", () => {
  const out = '{"ok":true,"error":null,"bytes":12,"queue":"ZDesigner GX420t","jobId":42}';

  assert.deepEqual(spoolerResult(out, "", 12), { ok: true, spoolerJobId: 42 });
});

test("a job the spooler received only partly is a failure", () => {
  const out = '{"ok":true,"error":null,"bytes":8,"jobId":42}';

  const r = spoolerResult(out, "", 12);
  assert.equal(r.ok, false);
  assert.match(r.error ?? "", /8 de 12 bytes/);
});

test("a helper error is reported with its message", () => {
  const out = '{"ok":false,"error":"OpenPrinter fallo"}';

  assert.deepEqual(spoolerResult(out, "", 12), { ok: false, error: "OpenPrinter fallo" });
});

test("no output from the helper is reported with stderr", () => {
  assert.deepEqual(spoolerResult("", "boom", 12), { ok: false, error: "boom" });
});

test("a connection check sends no payload", () => {
  const { args, stdin } = buildSpoolerInvocation("ZDesigner GK420t", "Check", "");

  assert.equal(stdin, "");
  assert.ok(!args.includes("-Base64"));
});

test("a helper failure that may have left the job queued is uncertain", () => {
  const out = '{"ok":false,"uncertain":true,"error":"AbortPrinter fallo"}';

  assert.equal(spoolerResult(out, "", 12).uncertain, true);
});
