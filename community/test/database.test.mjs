import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../server/db.mjs";
test("database persists and migrations are repeatable", () => {
  const dir = mkdtempSync(join(tmpdir(), "cuoi-db-"));
  try {
    let db = openDatabase(join(dir, "test.sqlite"));
    db.prepare(
      "INSERT INTO users(id,email,nickname,password_hash,created_at) VALUES(?,?,?,?,?)",
    ).run("a", "a@example.com", "A", "not-plaintext", 1);
    db.close();
    db = openDatabase(join(dir, "test.sqlite"));
    assert.equal(
      db.prepare("SELECT nickname FROM users WHERE id=?").get("a").nickname,
      "A",
    );
    assert.throws(() =>
      db
        .prepare(
          "INSERT INTO users(id,email,nickname,password_hash,created_at) VALUES(?,?,?,?,?)",
        )
        .run("b", "a@example.com", "B", "hash", 1),
    );
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
