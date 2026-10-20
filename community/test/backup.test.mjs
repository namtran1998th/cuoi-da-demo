import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../server/db.mjs";
import { backup } from "../scripts/backup.mjs";
test("offline backup restores records and files, rejects active/in-place/overwrite destinations", () => {
  const dir = mkdtempSync(join(tmpdir(), "cuoi-backup-"));
  try {
    const source = join(dir, "data"),
      target = join(dir, "backup");
    mkdirSync(join(source, "uploads"), { recursive: true });
    let db = openDatabase(join(source, "community.sqlite"));
    db.prepare("INSERT INTO users VALUES(?,?,?,?,?)").run(
      "user",
      "a@example.com",
      "Alice",
      "hash",
      1,
    );
    db.close();
    writeFileSync(join(source, "uploads", "file"), "media");
    assert.throws(() => backup(source, join(source, "nested")));
    assert.throws(() => backup(source, join(source, "..backup")));
    writeFileSync(join(source, "server.lock"), "pid");
    assert.throws(() => backup(source, target));
    rmSync(join(source, "server.lock"));
    backup(source, target);
    assert.equal(
      readFileSync(join(target, "uploads", "file"), "utf8"),
      "media",
    );
    db = openDatabase(join(target, "community.sqlite"));
    assert.equal(
      db.prepare("SELECT nickname FROM users").get().nickname,
      "Alice",
    );
    db.close();
    assert.throws(() => backup(source, target));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
