import {
  mkdirSync,
  accessSync,
  constants,
} from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { openDatabase } from "./db.mjs";
import { createApp } from "./app.mjs";
import { probePath } from "./media.mjs";
import { acquireProcessLock } from "./process-lock.mjs";
if (Number(process.versions.node.split(".")[0]) !== 24)
  throw Error("Use Node.js 24 LTS.");
const port = Number(process.env.PORT || 4174),
  origin = process.env.APP_ORIGIN || `http://localhost:${port}`,
  dataDir = resolve(process.env.DATA_DIR || "data"),
  production = process.env.NODE_ENV === "production";
const parsed = new URL(origin);
if (
  parsed.origin !== origin ||
  !["http:", "https:"].includes(parsed.protocol) ||
  (production && parsed.protocol !== "https:")
)
  throw Error("APP_ORIGIN must be an exact origin; production requires HTTPS.");
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw Error("Invalid PORT.");
execFileSync(probePath, ["-version"], { stdio: "ignore", windowsHide: true });
mkdirSync(dataDir, { recursive: true });
accessSync(dataDir, constants.W_OK);
// One process owns the media directory; startup reconciliation must never race another worker.
const releaseLock = acquireProcessLock(dataDir);
const db = openDatabase(join(dataDir, "community.sqlite"));
const app = createApp({
  db,
  dataDir,
  origin,
  secureCookies: parsed.protocol === "https:",
  trustProxy: process.env.TRUST_PROXY === "loopback" ? "loopback" : false,
});
const server = app.listen(port, "127.0.0.1", () => {
  console.log(`Cười Đã: ${origin} (local bind 127.0.0.1:${port})`);
  process.send?.("ready");
});
server.requestTimeout = 60000;
server.headersTimeout = 15000;
function cleanup() {
  try {
    db.close();
  } finally {
    releaseLock();
  }
}
server.on("error", (e) => {
  cleanup();
  console.error(e.message);
  process.exitCode = 1;
});
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  server.close(() => {
    cleanup();
    process.exit(0);
  });
  setTimeout(() => {
    server.closeAllConnections();
  }, 5000).unref();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("message", (message) => {
  if (message === "shutdown") stop();
});
