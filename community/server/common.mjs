import { createHash } from "node:crypto";
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export function fail(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}
export function text(value, min, max, label) {
  if (
    typeof value !== "string" ||
    [...value.trim()].length < min ||
    [...value.trim()].length > max
  )
    throw fail(400, "VALIDATION", `${label}: từ ${min} đến ${max} ký tự.`);
  return value.trim();
}
export const topics = [
  "Đời thường",
  "Mèo & đồng bọn",
  "Chuyện đi làm",
  "Học đường",
];
export function validTopic(value) {
  if (!topics.includes(value))
    throw fail(400, "VALIDATION", "Chủ đề không hợp lệ.");
  return value;
}
export function rate(db, key, limit, period, now) {
  key = digest(key);
  const t = now();
  db.prepare("DELETE FROM rate_limits WHERE expires_at<=?").run(t);
  const row = db.prepare("SELECT * FROM rate_limits WHERE key=?").get(key);
  if (row?.count >= limit)
    throw Object.assign(
      fail(429, "RATE_LIMIT", "Thao tác quá nhiều. Vui lòng thử lại sau."),
      { retryAfter: Math.ceil((row.expires_at - t) / 1000) },
    );
  db.prepare(
    "INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1",
  ).run(key, t + period);
}
export function pageArgs(query) {
  const limit = Number(query.limit ?? 20),
    cursor = Number(query.cursor ?? 0);
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50 ||
    !Number.isSafeInteger(cursor) ||
    cursor < 0 ||
    cursor > 100000
  )
    throw fail(400, "VALIDATION", "Phân trang không hợp lệ.");
  return { limit, cursor };
}
export const publicUser = (u) => ({ id: u.id, nickname: u.nickname });
