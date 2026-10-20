import { randomUUID } from "node:crypto";
import { fail, text, rate, pageArgs } from "./common.mjs";
import { findPost, postData } from "./posts.mjs";
const DAY = 86400000;
export function weekBounds(now) {
  const local = new Date(now + 7 * 3600000),
    days = (local.getUTCDay() + 6) % 7;
  const start =
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() - days,
    ) -
    7 * 3600000;
  return { start, end: start + 7 * DAY };
}
export function social(app, { db, now }, auth) {
  app.put("/api/posts/:id/like", auth.requireUser, (req, res) => {
    const p = findPost(db, req.params.id);
    if (typeof req.body.active !== "boolean")
      throw fail(400, "VALIDATION", "Trạng thái thích không hợp lệ.");
    if (p.author_id === req.user.id)
      throw fail(400, "SELF_LIKE", "Bạn không thể tự thích bài của mình.");
    if (req.body.active)
      db.prepare(
        "INSERT INTO likes VALUES(?,?,?,?) ON CONFLICT(user_id,post_id) DO UPDATE SET active=excluded.active",
      ).run(req.user.id, p.id, now(), Number(req.body.active));
    else
      db.prepare("UPDATE likes SET active=0 WHERE user_id=? AND post_id=?").run(
        req.user.id,
        p.id,
      );
    res.json(postData(db, p, req.user));
  });
  app.put("/api/posts/:id/bookmark", auth.requireUser, (req, res) => {
    const p = findPost(db, req.params.id);
    if (typeof req.body.active !== "boolean")
      throw fail(400, "VALIDATION", "Trạng thái lưu không hợp lệ.");
    if (req.body.active)
      db.prepare("INSERT OR IGNORE INTO bookmarks VALUES(?,?)").run(
        req.user.id,
        p.id,
      );
    else
      db.prepare("DELETE FROM bookmarks WHERE user_id=? AND post_id=?").run(
        req.user.id,
        p.id,
      );
    res.json(postData(db, p, req.user));
  });
  app.get("/api/posts/:id/comments", (req, res) => {
    findPost(db, req.params.id);
    const { limit, cursor } = pageArgs(req.query);
    const rows = db
      .prepare(
        "SELECT c.*,u.nickname FROM comments c JOIN users u ON u.id=c.author_id WHERE post_id=? ORDER BY c.created_at,c.id LIMIT ? OFFSET ?",
      )
      .all(req.params.id, limit + 1, cursor);
    res.json({
      items: rows.slice(0, limit).map((c) => ({
        id: c.id,
        text: c.text,
        author: { id: c.author_id, nickname: c.nickname },
        createdAt: new Date(c.created_at).toISOString(),
      })),
      nextCursor: rows.length > limit ? cursor + limit : null,
    });
  });
  app.post("/api/posts/:id/comments", auth.requireUser, (req, res) => {
    const p = findPost(db, req.params.id);
    rate(db, "comments:" + req.user.id, 30, 600000, now);
    const value = text(req.body.text, 1, 500, "Bình luận"),
      id = randomUUID();
    db.prepare("INSERT INTO comments VALUES(?,?,?,?,?)").run(
      id,
      p.id,
      req.user.id,
      value,
      now(),
    );
    res.status(201).json({
      id,
      text: value,
      author: { id: req.user.id, nickname: req.user.nickname },
      createdAt: new Date(now()).toISOString(),
    });
  });
  app.get("/api/profiles/:id", (req, res) => {
    const u = db
      .prepare("SELECT id,nickname FROM users WHERE id=?")
      .get(req.params.id);
    if (!u) throw fail(404, "NOT_FOUND", "Không tìm thấy thành viên.");
    res.json({
      ...u,
      postCount: db
        .prepare(
          "SELECT count(*) n FROM posts WHERE author_id=? AND status='ready'",
        )
        .get(u.id).n,
    });
  });
  app.get("/api/leaderboard", (req, res) => {
    const { start, end } = weekBounds(now());
    const items = db
      .prepare(
        `SELECT u.id,u.nickname,count(*) score,count(DISTINCT p.id) distinctPostCount FROM likes l JOIN posts p ON p.id=l.post_id JOIN users u ON u.id=p.author_id WHERE l.active=1 AND l.first_liked_at>=? AND l.first_liked_at<? AND l.user_id!=p.author_id AND p.status='ready' GROUP BY u.id HAVING count(*)>0 ORDER BY score DESC,distinctPostCount DESC,u.id ASC LIMIT 10`,
      )
      .all(start, end)
      .map((r) => ({
        author: { id: r.id, nickname: r.nickname },
        score: r.score,
        distinctPostCount: r.distinctPostCount,
      }));
    res.json({
      items,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
    });
  });
}
