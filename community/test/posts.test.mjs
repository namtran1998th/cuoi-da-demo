import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fixture } from "./helpers.mjs";
const video = readFileSync(new URL("./fixtures/flower.webm", import.meta.url));
export function upload(bytes = video, type = "video/webm") {
  const form = new FormData();
  form.append("title", "Video thử");
  form.append("topic", "Đời thường");
  form.append(
    "media",
    new Blob([bytes], { type }),
    type === "image/png" ? "picture.png" : "clip.webm",
  );
  return form;
}
test("media persists, streams ranges, enforces ownership and rejects invalid files", async () => {
  const f = await fixture();
  try {
    const a = await f.register("a@example.com"),
      b = await f.register("b@example.com");
    assert.equal(
      (await f.request("/api/posts", { method: "POST", body: upload() }))
        .status,
      401,
    );
    const post = await f.request("/api/posts", {
      method: "POST",
      cookie: a.cookie,
      body: upload(),
    });
    assert.equal(post.status, 201);
    const id = post.body.id;
    const other = await f.request("/api/posts/" + id, { cookie: b.cookie });
    assert.equal(other.status, 200);
    assert.ok(!JSON.stringify(other.body).includes("@example.com"));
    const range = await fetch(f.base + post.body.media.url, {
      headers: { range: "bytes=0-9" },
    });
    assert.equal(range.status, 206);
    assert.equal((await range.arrayBuffer()).byteLength, 10);
    assert.equal(
      (
        await f.request("/api/posts/" + id, {
          method: "PATCH",
          cookie: b.cookie,
          body: { title: "Stolen", topic: "Đời thường" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await f.request("/api/posts/" + id, {
          method: "DELETE",
          cookie: b.cookie,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await f.request("/api/posts", {
          method: "POST",
          cookie: a.cookie,
          body: upload(Buffer.from("bad"), "video/webm"),
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await f.request("/api/posts", {
          method: "POST",
          cookie: a.cookie,
          body: upload(Buffer.alloc(2 * 1024 * 1024 + 1), "image/png"),
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await f.request("/api/posts", {
          method: "POST",
          cookie: a.cookie,
          body: upload(video, "image/png"),
        })
      ).status,
      400,
    );
    assert.equal(readdirSync(f.dataDir + "/tmp").length, 0);
    assert.equal(
      (
        await f.request("/api/posts/" + id, {
          method: "DELETE",
          cookie: a.cookie,
        })
      ).status,
      200,
    );
    assert.equal((await f.request("/api/posts/" + id)).status, 404);
    assert.equal((await fetch(f.base + post.body.media.url)).status, 404);
  } finally {
    await f.close();
  }
});

test("response read failure cannot remove media from a ready post", async () => {
  const f = await fixture();
  try {
    const a = await f.register("failure@example.com");
    const prepare = f.db.prepare.bind(f.db);
    let injected = false;
    f.db.prepare = (sql) => {
      if (!injected && sql.startsWith("SELECT p.*,u.nickname FROM posts")) {
        injected = true;
        throw Error("Injected response read failure");
      }
      return prepare(sql);
    };
    assert.equal(
      (
        await f.request("/api/posts", {
          method: "POST",
          cookie: a.cookie,
          body: upload(),
        })
      ).status,
      500,
    );
    const feed = await f.request("/api/posts");
    assert.equal(feed.body.items.length, 1);
    assert.equal(
      (await fetch(f.base + feed.body.items[0].media.url)).status,
      200,
    );
  } finally {
    await f.close();
  }
});

test("expired uploads and database publication failures leave no visible post", async () => {
 const f=await fixture();
 try {
  const a=await f.register("expire@example.com");
  const pending=f.request("/api/posts",{method:"POST",cookie:a.cookie,body:upload()});
  const {digest}=await import("../server/common.mjs");
  for(let i=0;i<200 && !f.db.prepare("SELECT 1 FROM rate_limits WHERE key=?").get(digest("upload:"+a.body.id));i++) await new Promise(r=>setTimeout(r,5));
  f.setTime(f.now()+7*86400000);
  assert.equal((await pending).status,401);
  const b=await f.register("db-failure@example.com");
  const prepare=f.db.prepare.bind(f.db);
  f.db.prepare=sql=>{if(sql.startsWith("UPDATE posts SET status='ready'"))throw Error("Injected publication failure");return prepare(sql);};
  assert.equal((await f.request("/api/posts",{method:"POST",cookie:b.cookie,body:upload()})).status,500);
  assert.equal((await f.request("/api/posts")).body.items.length,0);
  assert.equal(readdirSync(f.dataDir+"/uploads").length,0);
  assert.equal(readdirSync(f.dataDir+"/tmp").length,0);
 } finally{await f.close();}
});
