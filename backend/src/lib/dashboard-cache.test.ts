import assert from "node:assert/strict";
import { createServer, type Socket } from "node:net";
import { test } from "node:test";
import { dashboardCacheKey, readDashboardCache, writeDashboardCache } from "./dashboard-cache";

test("dashboard cache isolates teacher scopes, uses TTL, and falls back when Redis is unavailable", async () => {
  const oldUrl = process.env.REDIS_URL;
  delete process.env.REDIS_URL;
  const key = dashboardCacheKey("TEACHER", "teacher-a");
  assert.notEqual(key, dashboardCacheKey("TEACHER", "teacher-b"));
  assert.notEqual(key, dashboardCacheKey("ADMIN", "teacher-a"));
  assert.equal(await readDashboardCache(key), null);
  const values = new Map<string, string>();
  const commands: string[][] = [];
  const sockets = new Set<Socket>();
  const server = createServer(socket => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    let buffer = Buffer.alloc(0);
    socket.on("data", chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length) {
        const header = buffer.toString("utf8").match(/^\*(\d+)\r\n/);
        if (!header) return;
        let offset = Buffer.byteLength(header[0]);
        const args: string[] = [];
        for (let i = 0; i < Number(header[1]); i++) {
          const lengthEnd = buffer.indexOf("\r\n", offset);
          if (lengthEnd < 0) return;
          const length = Number(buffer.subarray(offset + 1, lengthEnd).toString());
          const start = lengthEnd + 2;
          if (buffer.length < start + length + 2) return;
          args.push(buffer.subarray(start, start + length).toString());
          offset = start + length + 2;
        }
        buffer = buffer.subarray(offset);
        commands.push(args);
        if (args[0].toUpperCase() === "GET") {
          const value = values.get(args[1]);
          socket.write(value === undefined ? "$-1\r\n" : `$${Buffer.byteLength(value)}\r\n${value}\r\n`);
        } else {
          if (args[0].toUpperCase() === "SET") values.set(args[1], args[2]);
          socket.write("+OK\r\n");
        }
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server address");
  process.env.REDIS_URL = `redis://127.0.0.1:${address.port}`;
  try {
    await writeDashboardCache(key, { waiting: 2 });
    assert.deepEqual(await readDashboardCache(key), { waiting: 2 });
    assert.equal(await readDashboardCache(dashboardCacheKey("TEACHER", "teacher-b")), null);
    const set = commands.find(command => command[0].toUpperCase() === "SET");
    assert.ok(set);
    assert.deepEqual(set.slice(-2), ["EX", "10"]);
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
  try {
    assert.equal(await readDashboardCache(key), null);
  } finally {
    if (oldUrl === undefined) delete process.env.REDIS_URL; else process.env.REDIS_URL = oldUrl;
  }
});
