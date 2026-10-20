import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
test("deep links load the app, including under a hidden parent directory", async () => {
  const f = await fixture();
  try {
    for (const route of [
      "/me/posts",
      "/saved",
      "/leaderboard",
      "/posts/example",
      "/profiles/example",
    ]) {
      const r = await fetch(f.base + route);
      assert.equal(r.status, 200, route);
      assert.match(await r.text(), /id="ranking"/);
    }
    assert.equal((await fetch(f.base + "/api/unknown")).status, 404);
  } finally {
    await f.close();
  }
});
