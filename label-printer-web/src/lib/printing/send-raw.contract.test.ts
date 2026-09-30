import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// CONTRACT test, not a behaviour test: send-raw.ps1 only runs on Windows with winspool.drv,
// so on Linux the script text is checked against the documented Win32 contracts.
// Behaviour still needs a real print on the workstation (see M05).
const script = readFileSync(new URL("../../../scripts/send-raw.ps1", import.meta.url), "utf8");

test("StartDocPrinter is declared as the native API: 3 parameters, job id returned", () => {
  // https://learn.microsoft.com/en-us/windows/win32/printdocs/startdocprinter
  assert.match(script, /public static extern int StartDocPrinter\(IntPtr handle, int level, ref DOCINFOW docInfo\);/);
  assert.doesNotMatch(script, /out IntPtr jobId/);
});

test("a job id of 0 is treated as a StartDocPrinter failure", () => {
  assert.match(script, /if \(\$jobId -eq 0\)/);
});

test("every byte must be written, not just a successful WritePrinter call", () => {
  // https://learn.microsoft.com/en-us/windows/win32/printdocs/writeprinter
  assert.match(script, /\$offset -lt \$bytes\.Length/);
  assert.match(script, /AbortPrinter/);
});

test("status and send use the exact queue name, never a fuzzy match", () => {
  assert.doesNotMatch(script, /-like "\*\$Printer\*"/);
});

test("the spooler job id is reported to the app", () => {
  assert.match(script, /jobId = \$jobId/);
});

test("a failed abort is reported as uncertain, never as a clean failure", () => {
  assert.match(script, /\$aborted = \[Spool\]::AbortPrinter\(\$handle\)/);
  assert.match(script, /uncertain = -not \$aborted/);
});

test("EndDocPrinter failing after every byte was written is uncertain", () => {
  assert.match(script, /EndDocPrinter fallo[^\n]*\n[^\n]*uncertain = \$true/);
});
