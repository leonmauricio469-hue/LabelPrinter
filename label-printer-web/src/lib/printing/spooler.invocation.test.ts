import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSpoolerInvocation, zplPayload } from "./spooler.invocation.ts";

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

test("a connection check sends no payload", () => {
  const { args, stdin } = buildSpoolerInvocation("ZDesigner GK420t", "Check", "");

  assert.equal(stdin, "");
  assert.ok(!args.includes("-Base64"));
});
