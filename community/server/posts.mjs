import multer from "multer";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { rename } from "node:fs/promises";
import { fail, text, validTopic, rate, pageArgs } from "./common.mjs";
import { validateMedia, removeFile, reconcileMedia } from "./media.mjs";
export function postData(db, row, user) {
  return {
    id: row.id,
    author: { id: row.author_id, nickname: row.nickname },
    title: row.title,
    topic: row.topic,
    media: {
      url: "/media/" + row.media_key,
      type: row.media_type,
      size: row.size,
    },
    createdAt: new Date(row.created_at).toISOString(),
    likeCount: db
      .prepare("SELECT count(*) n FROM likes WHERE post_id=? AND active=1")
      .get(row.id).n,
    commentCount: db
      .prepare("SELECT count(*) n FROM comments WHERE post_id=?")
      .get(row.id).n,
    liked: !!db
      .prepare("SELECT 1 FROM likes WHERE post_id=? AND user_id=? AND active=1")
      .get(row.id, user?.id || ""),
    saved: !!db
      .prepare("SELECT 1 FROM bookmarks WHERE post_id=? AND user_id=?")
      .get(row.id, user?.id || ""),
  };
}
export function findPost(db, id) {
  const p = db
    .prepare(
      "SELECT p.*,u.nickname FROM posts p JOIN users u ON u.id=p.author_id WHERE p.id=? AND p.status='ready'",
    )
    .get(id);
  if (!p) throw fail(404, "NOT_FOUND", "Bài viết không còn tồn tại.");
  return p;
}
export function posts(app, { db, dataDir, now }, auth) {
  reconcileMedia(db, dataDir);
  const upload = multer({
    dest: join(dataDir, "tmp"),
    limits: {
      fileSize: 50 * 1024 * 1024,
      files: 1,
      fields: 2,
      parts: 3,
      fieldSize: 2048,
      fieldNameSize: 30,
      fieldArrayIndexLimit: 0,
    },
  }).single("media");
  app.get("/api/posts", (req, res) => {
    const { limit, cursor } = pageArgs(req.query);
    const where = ["p.status='ready'"],
      params = [];
    if (req.query.topic) {
      where.push("p.topic=?");
      params.push(validTopic(req.query.topic));
    }
    if (req.query.author) {
      where.push("p.author_id=?");
      params.push(text(req.query.author, 1, 64, "Tác giả"));
    }
    if (req.query.q) {
      where.push("(p.title LIKE ? OR u.nickname LIKE ?)");
      const q = text(req.query.q, 1, 180, "Tìm kiếm");
      params.push("%" + q + "%", "%" + q + "%");
    }
    if (req.query.saved === "1") {
      if (!req.user) throw fail(401, "AUTH_REQUIRED", "Vui lòng đăng nhập.");
      where.push(
        "EXISTS(SELECT 1 FROM bookmarks b WHERE b.post_id=p.id AND b.user_id=?)",
      );
      params.push(req.user.id);
    }
    const order =
      req.query.tab === "top"
        ? "votes DESC,p.created_at DESC,p.id"
        : req.query.tab === "hot"
          ? "recent DESC,p.created_at DESC,p.id"
          : "p.created_at DESC,p.id";
    const rows = db
      .prepare(
        `SELECT p.*,u.nickname,(SELECT count(*) FROM likes l WHERE l.post_id=p.id AND l.active=1) votes,(SELECT count(*) FROM likes l WHERE l.post_id=p.id AND l.active=1 AND l.first_liked_at>=?) recent FROM posts p JOIN users u ON u.id=p.author_id WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ? OFFSET ?`,
      )
      .all(now() - 7 * 86400000, ...params, limit + 1, cursor);
    res.json({
      items: rows.slice(0, limit).map((p) => postData(db, p, req.user)),
      nextCursor: rows.length > limit ? cursor + limit : null,
    });
  });
  app.get("/api/posts/:id", (req, res) =>
    res.json(postData(db, findPost(db, req.params.id), req.user)),
  );
  app.post(
    "/api/posts",
    auth.requireUser,
    (req, res, next) => {
      rate(db, "upload:" + req.user.id, 10, 3600000, now);
      upload(req, res, (e) => {
        if (e)
          return next(
            fail(
              400,
              "UPLOAD_INVALID",
              "Tệp quá lớn hoặc biểu mẫu tải lên không hợp lệ.",
            ),
          );
        next();
      });
    },
    async (req, res) => {
      let key,
        id,
        published = false;
      try {
        if (!req.file)
          throw fail(400, "MEDIA_REQUIRED", "Vui lòng chọn ảnh hoặc video.");
        const title = text(req.body.title, 1, 180, "Tiêu đề"),
          topic = validTopic(req.body.topic),
          media = await validateMedia(req.file.path, req.file.mimetype);
        const user = auth.identify(req);
        if (!user)
          throw fail(401, "AUTH_REQUIRED", "Phiên đăng nhập đã hết hạn.");
        id = randomUUID();
        key = randomUUID();
        db.prepare("INSERT INTO posts VALUES(?,?,?,?,?,?,?,?,?,?)").run(
          id,
          user.id,
          title,
          topic,
          key,
          media.type,
          media.size,
          now(),
          now(),
          "pending",
        );
        await rename(req.file.path, join(dataDir, "uploads", key));
        db.prepare("UPDATE posts SET status='ready' WHERE id=?").run(id);
        published = true;
        res.status(201).json(postData(db, findPost(db, id), user));
      } catch (e) {
        if (req.file) await removeFile(req.file.path).catch(() => {});
        if (key && !published)
          await removeFile(join(dataDir, "uploads", key)).catch(() => {});
        if (id && !published)
          db.prepare("DELETE FROM posts WHERE id=? AND status='pending'").run(
            id,
          );
        throw e;
      }
    },
  );
  app.patch("/api/posts/:id", auth.requireUser, (req, res) => {
    const p = findPost(db, req.params.id);
    if (p.author_id !== req.user.id)
      throw fail(403, "FORBIDDEN", "Bạn chỉ được sửa bài của mình.");
    db.prepare("UPDATE posts SET title=?,topic=?,updated_at=? WHERE id=?").run(
      text(req.body.title, 1, 180, "Tiêu đề"),
      validTopic(req.body.topic),
      now(),
      p.id,
    );
    res.json(postData(db, findPost(db, p.id), req.user));
  });
  app.delete("/api/posts/:id", auth.requireUser, async (req, res) => {
    const p = findPost(db, req.params.id);
    if (p.author_id !== req.user.id)
      throw fail(403, "FORBIDDEN", "Bạn chỉ được xóa bài của mình.");
    db.prepare("UPDATE posts SET status='deleted',updated_at=? WHERE id=?").run(
      now(),
      p.id,
    );
    await removeFile(join(dataDir, "uploads", p.media_key)).catch(() =>
      console.warn("Deferred media cleanup for post", p.id),
    );
    res.json({ ok: true });
  });
  app.get("/media/:key", (req, res, next) => {
    const p = db
      .prepare(
        "SELECT media_type FROM posts WHERE media_key=? AND status='ready'",
      )
      .get(req.params.key);
    if (!p) return next(fail(404, "NOT_FOUND", "Không tìm thấy tệp."));
    res.type(p.media_type);
    res.set("Cache-Control", "private,no-cache");
    res.sendFile(
      req.params.key,
      { root: resolve(dataDir, "uploads"), dotfiles: "deny" },
      (e) => {
        if (e && e.code !== "ECONNABORTED") next(e);
      },
    );
  });
}
