import test from "node:test";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { backup } from "../scripts/backup.mjs";

test("PM2 shutdown message stops cleanly and server restarts after forced termination", { timeout: 30000 }, async () => {
  const root = mkdtempSync(join(tmpdir(), "cuoi-lifecycle-"));
  const data = join(root, "data");
  let child;
  function start() {
    child = fork(new URL("../server/index.mjs", import.meta.url), [], {
      env: { ...process.env, DATA_DIR: data, PORT: "4196", APP_ORIGIN: "http://localhost:4196", NODE_ENV: "test" },
      stdio: ["ignore", "ignore", "pipe", "ipc"],
    });
    return once(child, "message");
  }
  try {
    await start();
    assert.throws(() => backup(data, join(root, "backup")), /locked/);
    let exited = once(child, "exit");
    child.send("shutdown");
    assert.equal((await exited)[0], 0);
    await start();
    exited = once(child, "exit");
    child.kill("SIGKILL");
    await exited;
    await start();
    assert.equal((await fetch("http://localhost:4196/api/health")).status, 200);
    exited = once(child, "exit");
    child.send("shutdown");
    await exited;
    backup(data, join(root, "backup"));
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
    rmSync(root, { recursive: true, force: true });
  }
});
