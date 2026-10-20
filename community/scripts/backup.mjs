import { resolve, relative, isAbsolute, join, sep } from "node:path";
import {
  existsSync,
  cpSync,
  mkdirSync,
  realpathSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { acquireProcessLock } from "../server/process-lock.mjs";
export function backup(source, target) {
  source = realpathSync(source);
  target = resolve(target);
  if (existsSync(target))
    throw Error("Backup destination already exists; use a new path.");
  const parent = realpathSync(resolve(target, ".."));
  target = join(parent, target.split(/[\\/]/).at(-1));
  const rel = relative(source, target);
  if (!rel || (rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel)))
    throw Error("Backup must be outside the live data directory.");
  if (!existsSync(join(source, "community.sqlite")))
    throw Error("Missing database.");
  const releaseLock = acquireProcessLock(source);
  try {
    mkdirSync(target);
    for (const name of [
      "community.sqlite",
      "community.sqlite-wal",
      "community.sqlite-shm",
      "uploads",
    ])
      if (existsSync(join(source, name)))
        cpSync(join(source, name), join(target, name), {
          recursive: true,
          errorOnExist: true,
          force: false,
        });
  } finally {
    releaseLock();
  }
  return target;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv.length !== 4)
      throw Error(
        "Usage: node scripts/backup.mjs SOURCE_DATA_DIR NEW_BACKUP_DIR",
      );
    console.log("Backup saved:", backup(process.argv[2], process.argv[3]));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
