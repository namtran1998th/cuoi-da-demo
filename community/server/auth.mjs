import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { digest, fail, text, rate } from "./common.mjs";
const derive = promisify(scrypt),
  DAY = 86400000;
let hashing = 0;
async function key(password, salt, N = 131072, r = 8, p = 1) {
  if (hashing >= 2)
    throw fail(503, "BUSY", "Máy chủ đang bận. Vui lòng thử lại.");
  hashing++;
  try {
    return await derive(password, salt, 64, {
      N,
      r,
      p,
      maxmem: 192 * 1024 * 1024,
    });
  } finally {
    hashing--;
  }
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$131072$8$1$${salt}$${(await key(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password, hash) {
  const [algorithm, N, r, p, salt, expected] = hash.split("$");
  if (algorithm !== "scrypt") return false;
  const actual = await key(password, salt, Number(N), Number(r), Number(p));
  const bytes = Buffer.from(expected, "hex");
  return bytes.length === actual.length && timingSafeEqual(actual, bytes);
}
function validPassword(value) {
  if (
    typeof value !== "string" ||
    [...value].length < 12 ||
    [...value].length > 128
  )
    throw fail(400, "VALIDATION", "Mật khẩu cần từ 12 đến 128 ký tự.");
  return value;
}
function email(value) {
  const result = text(value, 3, 254, "Email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
    throw fail(400, "VALIDATION", "Email không hợp lệ.");
  return result;
}
export function authentication(app, { db, now, secureCookies }) {
  const cookieName = secureCookies ? "__Host-cuoi_session" : "cuoi_session";
  const options = {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies,
    path: "/",
    maxAge: 7 * DAY,
  };
  function token(req) {
    const part = (req.headers.cookie || "")
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(cookieName + "="));
    return part?.slice(cookieName.length + 1) || "";
  }
  function identify(req) {
    const t = token(req);
    if (!/^[a-f0-9]{64}$/.test(t)) return null;
    return (
      db
        .prepare(
          "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?",
        )
        .get(digest(t), now()) || null
    );
  }
  const requireUser = (req, res, next) => {
    req.user = identify(req);
    if (!req.user)
      return next(fail(401, "AUTH_REQUIRED", "Vui lòng đăng nhập."));
    next();
  };
  function session(res, id) {
    const raw = randomBytes(32).toString("hex");
    db.prepare("DELETE FROM sessions WHERE expires_at<=?").run(now());
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      digest(raw),
      id,
      now() + 7 * DAY,
    );
    res.cookie(cookieName, raw, options);
  }
  const me = (u) => ({ id: u.id, email: u.email, nickname: u.nickname });
  app.use((req, res, next) => {
    req.user = identify(req);
    next();
  });
  app.post("/api/auth/register", async (req, res) => {
    rate(db, "register:" + req.ip, 5, 3600000, now);
    const address = email(req.body.email),
      nickname = text(req.body.nickname, 2, 40, "Biệt danh"),
      password = validPassword(req.body.password);
    const hash = await hashPassword(password);
    const user = { id: randomUUID(), email: address, nickname };
    try {
      db.prepare("INSERT INTO users VALUES(?,?,?,?,?)").run(
        user.id,
        address,
        nickname,
        hash,
        now(),
      );
    } catch (e) {
      if (e.message.includes("UNIQUE"))
        throw fail(409, "EMAIL_EXISTS", "Email đã được đăng ký.");
      throw e;
    }
    session(res, user.id);
    res.status(201).json(user);
  });
  app.post("/api/auth/login", async (req, res) => {
    rate(db, "login-ip:" + req.ip, 10, 900000, now);
    const address = email(req.body.email),
      password = validPassword(req.body.password);
    rate(db, "login-email:" + address, 10, 900000, now);
    const user = db.prepare("SELECT * FROM users WHERE email=?").get(address);
    // Same scrypt work even when the account does not exist.
    const fallback =
      "scrypt$131072$8$1$00000000000000000000000000000000$" + "00".repeat(64);
    const valid = await verifyPassword(
      password,
      user?.password_hash || fallback,
    );
    const currentUser =
      user && db.prepare("SELECT * FROM users WHERE id=?").get(user.id);
    if (!user || !valid || currentUser?.password_hash !== user.password_hash)
      throw fail(401, "INVALID_LOGIN", "Email hoặc mật khẩu không đúng.");
    session(res, user.id);
    res.json(me(user));
  });
  app.get("/api/auth/me", requireUser, (req, res) => res.json(me(req.user)));
  app.post("/api/auth/logout", requireUser, (req, res) => {
    db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
      digest(token(req)),
    );
    res.clearCookie(cookieName, { ...options, maxAge: undefined });
    res.json({ ok: true });
  });
  app.post("/api/auth/change-password", requireUser, async (req, res) => {
    rate(db, "password:" + req.user.id, 5, 900000, now);
    const current = validPassword(req.body.currentPassword),
      password = validPassword(req.body.password);
    if (!(await verifyPassword(current, req.user.password_hash)))
      throw fail(401, "INVALID_PASSWORD", "Mật khẩu hiện tại không đúng.");
    const hashed = await hashPassword(password);
    const currentUser = identify(req);
    if (!currentUser || currentUser.password_hash !== req.user.password_hash)
      throw fail(
        401,
        "AUTH_REQUIRED",
        "Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại.",
      );
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(
        hashed,
        req.user.id,
      );
      db.prepare("DELETE FROM sessions WHERE user_id=?").run(req.user.id);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    session(res, req.user.id);
    res.json({ ok: true });
  });
  return { requireUser, identify };
}
