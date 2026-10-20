import express from "express";
import { fileURLToPath } from "node:url";
import { authentication } from "./auth.mjs";
import { fail } from "./common.mjs";
import { posts } from "./posts.mjs";
import { social } from "./social.mjs";
export function createApp({
  db,
  dataDir,
  origin,
  secureCookies = true,
  now = Date.now,
  trustProxy = false,
}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", trustProxy);
  app.locals.context = { db, dataDir, origin, secureCookies, now };
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    });
    if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (req.headers.origin !== origin ||
        req.headers["x-cuoi-da-request"] !== "1" ||
        req.headers["sec-fetch-site"] === "cross-site")
    )
      return next(fail(403, "CSRF", "Nguồn yêu cầu không hợp lệ."));
    next();
  });
  app.use(express.json({ limit: "16kb" }));
  app.use((req, res, next) => {
    req.body ??= {};
    next();
  });
  const auth = authentication(app, { db, now, secureCookies });
  app.locals.auth = auth;
  posts(app, { db, dataDir, now }, auth);
  social(app, { db, now }, auth);
  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.use(express.static(fileURLToPath(new URL("../public", import.meta.url))));
  app.get(
    ["/posts/:id", "/profiles/:id", "/me/posts", "/saved", "/leaderboard"],
    (req, res) =>
      res.sendFile("index.html", {
        root: fileURLToPath(new URL("../public", import.meta.url)),
      }),
  );
  app.use((req, res, next) => next(fail(404, "NOT_FOUND", "Không tìm thấy.")));
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err.retryAfter) res.set("Retry-After", String(err.retryAfter));
    const status = err.status || (400 === err.statusCode && 400) || 500;
    res
      .status(status)
      .json({
        error: {
          code: err.code || "INTERNAL",
          message:
            status >= 500
              ? "Máy chủ chưa xử lý được yêu cầu. Vui lòng thử lại."
              : err.message,
        },
      });
  });
  return app;
}
