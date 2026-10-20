import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { acquireProcessLock } from "../server/process-lock.mjs";

test("process lock excludes other servers and is released by OS after abrupt exit", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cuoi-lock-"));
  try {
    const release = acquireProcessLock(dir);
    assert.throws(() => acquireProcessLock(dir), /locked/i);
    release();
    const source = `import {acquireProcessLock} from ${JSON.stringify(new URL("../server/process-lock.mjs", import.meta.url).href)}; acquireProcessLock(process.argv[1]); process.send('locked'); process.on('message',()=>process.exit(1));`;
    const child = spawn(process.execPath, ["--input-type=module", "-e", source, dir], { stdio: ["ignore", "ignore", "pipe", "ipc"], windowsHide: true });
    await once(child, "message");
    assert.throws(() => acquireProcessLock(dir), /locked/i);
    const exited = once(child, "exit");
    child.send("crash");
    await exited;
    acquireProcessLock(dir)();
    writeFileSync(join(dir, "server.lock"), "");
    assert.throws(() => acquireProcessLock(dir), /legacy/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
