import assert from "node:assert/strict";
import net from "node:net";
import { test } from "node:test";
import { sendZpl } from "./tcp.transport.ts";

/** A local printer stand-in on a random port. */
async function withServer(
  onConnection: (socket: net.Socket) => void,
  run: (port: number) => Promise<void>,
): Promise<void> {
  const server = net.createServer(onConnection);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run((server.address() as net.AddressInfo).port);
  } finally {
    server.close();
  }
}

test("success is reported only after the printer received every byte", async () => {
  const zpl = "^XA^FDHOLA^FS^XZ".repeat(1000);
  let received = "";
  let ended = false;

  await withServer(
    (socket) => {
      socket.on("data", (d) => (received += d.toString()));
      socket.on("end", () => (ended = true));
    },
    async (port) => {
      const result = await sendZpl("127.0.0.1", port, zpl);

      assert.deepEqual(result, { ok: true });
      assert.equal(ended, true, "resolved before the stream was finished");
      assert.equal(received, zpl);
    },
  );
});

test("a connection dropped mid-batch is a failure, not a success", async () => {
  const zpl = "X".repeat(20 * 1024 * 1024);

  await withServer(
    (socket) => socket.once("data", () => socket.resetAndDestroy()),
    async (port) => {
      const result = await sendZpl("127.0.0.1", port, zpl);

      assert.equal(result.ok, false);
      // Part of the batch reached the printer: some labels may come out.
      assert.equal(result.uncertain, true);
    },
  );
});

test("a printer that cannot be reached surely printed nothing", async () => {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));

  const result = await sendZpl("127.0.0.1", port, "^XA^XZ");

  assert.equal(result.ok, false);
  assert.notEqual(result.uncertain, true);
});
