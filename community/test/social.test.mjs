import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import { weekBounds } from "../server/social.mjs";
test("Vietnam week is half-open at Monday midnight", () => {
  const t = Date.parse("2026-10-18T17:00:00Z");
  assert.deepEqual(weekBounds(t), { start: t, end: t + 7 * 86400000 });
  assert.equal(weekBounds(t - 1).end, t);
});
test("likes are idempotent, private information stays private, ranks exclude self/deleted/old likes", async () => {
  const f = await fixture();
  try {
    const a = await f.register("a@example.com", "Alice"),
      b = await f.register("b@example.com", "Bob");
    const id = "post-test";
    f.db
      .prepare("INSERT INTO posts VALUES(?,?,?,?,?,?,?,?,?,?)")
      .run(
        id,
        a.body.id,
        "Meme",
        "Đời thường",
        "key",
        "image/png",
        10,
        f.now(),
        f.now(),
        "ready",
      );
    const self = await f.request(`/api/posts/${id}/like`, {
      method: "PUT",
      cookie: a.cookie,
      body: { active: true },
    });
    assert.equal(self.status, 400);
    const votes = await Promise.all(
      Array.from({ length: 20 }, () =>
        f.request(`/api/posts/${id}/like`, {
          method: "PUT",
          cookie: b.cookie,
          body: { active: true },
        }),
      ),
    );
    assert.ok(votes.every((r) => r.status === 200));
    assert.equal(f.db.prepare("SELECT count(*) n FROM likes").get().n, 1);
    let board = await f.request("/api/leaderboard");
    assert.equal(board.body.items[0].score, 1);
    assert.equal(board.body.items[0].author.nickname, "Alice");
    assert.ok(!JSON.stringify(board.body).includes("email"));
    assert.equal(
      (await f.request("/api/profiles/" + a.body.id)).body.nickname,
      "Alice",
    );
    assert.equal((await f.request("/api/posts?saved=1")).status, 401);
    assert.equal(
      (
        await f.request(`/api/posts/${id}/comments`, {
          method: "POST",
          cookie: b.cookie,
          body: { text: "<img onerror=alert(1)>" },
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await f.request(`/api/posts/${id}/bookmark`, {
          method: "PUT",
          cookie: b.cookie,
          body: { active: true },
        })
      ).status,
      200,
    );
    assert.equal(
      (await f.request("/api/posts?saved=1", { cookie: b.cookie })).body.items
        .length,
      1,
    );
    assert.equal(
      (await f.request("/api/posts?saved=1", { cookie: a.cookie })).body.items
        .length,
      0,
    );
    const timestamp = f.db
      .prepare("SELECT first_liked_at FROM likes")
      .get().first_liked_at;
    f.setTime(f.now() + 86400000);
    await f.request(`/api/posts/${id}/like`, {
      method: "PUT",
      cookie: b.cookie,
      body: { active: false },
    });
    assert.equal((await f.request("/api/leaderboard")).body.items.length, 0);
    await f.request(`/api/posts/${id}/like`, {
      method: "PUT",
      cookie: b.cookie,
      body: { active: true },
    });
    assert.equal(
      f.db.prepare("SELECT first_liked_at FROM likes").get().first_liked_at,
      timestamp,
    );
    f.setTime(Date.parse("2026-10-25T17:00:00Z"));
    assert.equal((await f.request("/api/leaderboard")).body.items.length, 0);
    f.setTime(timestamp);
    f.db.prepare("UPDATE posts SET status='deleted'").run();
    assert.equal((await f.request("/api/leaderboard")).body.items.length, 0);
  } finally {
    await f.close();
  }
});

test("inactive-first request does not backdate a future first like", async () => {
  const f = await fixture();
  try {
    const a = await f.register("author@example.com"),
      b = await f.register("reader@example.com");
    f.db
      .prepare("INSERT INTO posts VALUES(?,?,?,?,?,?,?,?,?,?)")
      .run(
        "inactive-first",
        a.body.id,
        "Meme",
        "Đời thường",
        "key",
        "image/png",
        10,
        f.now(),
        f.now(),
        "ready",
      );
    const vote = (active) =>
      f.request("/api/posts/inactive-first/like", {
        method: "PUT",
        cookie: b.cookie,
        body: { active },
      });
    assert.equal((await vote(false)).status, 200);
    assert.equal(f.db.prepare("SELECT count(*) n FROM likes").get().n, 0);
    f.setTime(Date.parse("2026-10-25T17:00:00Z"));
    assert.equal((await vote(true)).status, 200);
    assert.equal((await f.request("/api/leaderboard")).body.items[0].score, 1);
  } finally {
    await f.close();
  }
});
