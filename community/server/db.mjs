import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
export function openDatabase(file) {
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(
    "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
  );
  db.exec("CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY)");
  if (!db.prepare("SELECT 1 FROM migrations WHERE version=1").get()) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(
        readFileSync(
          new URL("../migrations/001-initial.sql", import.meta.url),
          "utf8",
        ),
      );
      db.exec("INSERT INTO migrations VALUES(1); COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      db.close();
      throw e;
    }
  }
  return db;
}
