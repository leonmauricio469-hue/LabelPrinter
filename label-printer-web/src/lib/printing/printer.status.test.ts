import assert from "node:assert/strict";
import { test } from "node:test";
import { statusForTransport } from "./printer.status.ts";
import type { QueueStatus } from "./queue.status.types.ts";

const usbStatus = { state: "ready", message: "Lista" } as QueueStatus;

test("a network printer never reports the status of a Windows queue", async () => {
  let queueRead = false;
  const status = await statusForTransport(
    { transport: "tcp", host: "192.168.2.80", port: 9100, printerName: "ZDesigner GX420t" },
    async () => {
      queueRead = true;
      return usbStatus;
    },
  );

  assert.equal(queueRead, false);
  assert.equal(status.state, "unknown");
  assert.match(status.message, /192\.168\.2\.80:9100/);
});

test("a USB printer reports the status of its Windows queue", async () => {
  let asked = "";
  const status = await statusForTransport(
    { transport: "usb", host: "127.0.0.1", port: 9100, printerName: "ZDesigner GX420t" },
    async (name) => {
      asked = name;
      return usbStatus;
    },
  );

  assert.equal(asked, "ZDesigner GX420t");
  assert.equal(status, usbStatus);
});
