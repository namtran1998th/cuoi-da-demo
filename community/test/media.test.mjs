import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateMedia } from "../server/media.mjs";
test("images must decode, including valid PNG checksums", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cuoi-image-"));
  try {
    const valid = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    const path = join(dir, "image.png");
    await writeFile(path, valid);
    assert.equal((await validateMedia(path, "image/png")).type, "image/png");
    for (const offset of [29, 50]) {
      const broken = Buffer.from(valid);
      broken[offset] ^= 255;
      await writeFile(path, broken);
      await assert.rejects(validateMedia(path, "image/png"), {
        code: "MEDIA_INVALID",
      });
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
