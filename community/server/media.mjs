import { execFile } from "node:child_process";
import { promisify } from "node:util";
import probe from "ffprobe-static";
import sharp from "sharp";
import { open, stat, unlink, readFile } from "node:fs/promises";
import { crc32 } from "node:zlib";
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { fail } from "./common.mjs";
const execute = promisify(execFile);
export const probePath = process.env.FFPROBE_PATH || probe.path;
export async function validateMedia(path, declared) {
  const info = await stat(path),
    handle = await open(path, "r"),
    b = Buffer.alloc(32);
  try {
    await handle.read(b, 0, 32, 0);
  } finally {
    await handle.close();
  }
  let type;
  if (b.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")))
    type = "image/png";
  else if (b[0] === 255 && b[1] === 216 && b[2] === 255) type = "image/jpeg";
  else if (/^GIF8[79]a/.test(b.toString("ascii"))) type = "image/gif";
  else if (
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP"
  )
    type = "image/webp";
  else if (b.toString("ascii", 4, 8) === "ftyp") type = "video/mp4";
  else if (b.subarray(0, 4).equals(Buffer.from("1a45dfa3", "hex")))
    type = "video/webm";
  if (
    !type ||
    type !== declared ||
    !info.size ||
    info.size > (type.startsWith("video/") ? 50 : 2) * 1024 * 1024
  )
    throw fail(
      400,
      "MEDIA_INVALID",
      "Tệp sai định dạng hoặc vượt giới hạn dung lượng.",
    );
  try {
    const { stdout, stderr } = await execute(
      probePath,
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file",
        "-show_entries",
        "format=format_name,duration:stream=codec_type,codec_name,width,height",
        "-of",
        "json",
        path,
      ],
      { timeout: 15000, maxBuffer: 1024 * 1024, windowsHide: true },
    );
    if (stderr.trim()) throw Error("Media decoder reported errors");
    const result = JSON.parse(stdout),
      stream = result.streams?.find((s) => s.codec_type === "video");
    if (
      !stream?.width ||
      !stream?.height ||
      stream.width * stream.height > 40000000
    )
      throw Error("Invalid dimensions");
    if (
      type === "video/webm" &&
      !["vp8", "vp9", "av1"].includes(stream.codec_name)
    )
      throw Error("Not WebM video");
    if (
      type === "video/mp4" &&
      !["h264", "hevc", "av1", "vp9", "mpeg4"].includes(stream.codec_name)
    )
      throw Error("Unsupported video");
    if (type.startsWith("image/")) {
      if (type === "image/png") {
        const bytes = await readFile(path);
        let offset = 8,
          ended = false;
        while (offset + 12 <= bytes.length) {
          const length = bytes.readUInt32BE(offset),
            end = offset + 12 + length;
          if (
            end > bytes.length ||
            crc32(bytes.subarray(offset + 4, end - 4)) !==
              bytes.readUInt32BE(end - 4)
          )
            throw Error("Invalid PNG chunk");
          const last =
            bytes.toString("ascii", offset + 4, offset + 8) === "IEND";
          offset = end;
          if (last) {
            ended = true;
            break;
          }
        }
        if (!ended || offset !== bytes.length) throw Error("Incomplete PNG");
      }
      const codecs = {
        "image/png": "png",
        "image/jpeg": "mjpeg",
        "image/gif": "gif",
        "image/webp": "webp",
      };
      if (stream.codec_name !== codecs[type]) throw Error("Invalid image");
      await sharp(path, {
        failOn: "warning",
        limitInputPixels: 40000000,
        animated: true,
      })
        .raw()
        .toBuffer();
    }
    return { type, size: info.size };
  } catch {
    throw fail(
      400,
      "MEDIA_INVALID",
      "Không đọc được ảnh/video. Hãy chọn tệp hợp lệ khác.",
    );
  }
}
export function reconcileMedia(db, dataDir) {
  mkdirSync(join(dataDir, "tmp"), { recursive: true });
  mkdirSync(join(dataDir, "uploads"), { recursive: true });
  for (const name of readdirSync(join(dataDir, "tmp")))
    try {
      unlinkSync(join(dataDir, "tmp", name));
    } catch {}
  for (const row of db
    .prepare("SELECT id,media_key FROM posts WHERE status!='ready'")
    .all()) {
    try {
      unlinkSync(join(dataDir, "uploads", row.media_key));
    } catch (e) {
      if (e.code !== "ENOENT") continue;
    }
    db.prepare("DELETE FROM posts WHERE id=? AND status='pending'").run(row.id);
  }
}
export async function removeFile(path) {
  try {
    await unlink(path);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
