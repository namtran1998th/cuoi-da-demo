import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";

// A separate SQLite transaction supplies an OS lock, released even after a crash.
// Never delete this database: every server and backup must lock the same file.
export function acquireProcessLock(dataDir) {
  if (existsSync(join(dataDir, "server.lock")))
    throw Error("Legacy server.lock exists. Stop the old server before removing this marker.");
  const lock = new DatabaseSync(join(dataDir, "process-lock.sqlite"));
  try {
    lock.exec("PRAGMA busy_timeout=0; BEGIN EXCLUSIVE");
  } catch {
    lock.close();
    throw Error("Data directory is locked by another server or backup.");
  }
  return () => lock.close();
}
