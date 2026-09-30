import path from "node:path";

const SCRIPT = path.resolve(process.cwd(), "scripts", "send-raw.ps1");

export type SpoolerMode = "Send" | "Check";

export interface SpoolerInvocation {
  args: string[];
  /** Written to the child's stdin and then closed. */
  stdin: string;
}

/** Base64 of the ZPL bytes sent to the spooler: UTF-8, as the label's `^CI28` declares. */
export function zplPayload(zpl: string): string {
  return Buffer.from(zpl, "utf8").toString("base64");
}

/**
 * Builds the powershell.exe arguments and stdin payload for send-raw.ps1.
 *
 * The payload goes through stdin, never as an argument: CreateProcess caps the whole
 * command line at 32,767 chars, which a batch of ~7 labels already exceeds.
 */
export function buildSpoolerInvocation(
  printerName: string,
  mode: SpoolerMode,
  base64: string,
): SpoolerInvocation {
  return {
    args: [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      SCRIPT,
      "-Printer",
      printerName,
      "-Mode",
      mode,
    ],
    stdin: mode === "Send" ? base64 : "",
  };
}
