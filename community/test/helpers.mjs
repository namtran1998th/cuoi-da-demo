import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../server/db.mjs";
import { createApp } from "../server/app.mjs";
export async function fixture() {
  const dataDir = mkdtempSync(join(tmpdir(), "cuoi-api-"));
  let clock = Date.parse("2026-10-20T08:00:00Z");
  const db = openDatabase(join(dataDir, "community.sqlite"));
  const app = createApp({
    db,
    dataDir,
    origin: "http://localhost:4174",
    secureCookies: false,
    now: () => clock,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(
    path,
    { method = "GET", body, cookie = "", headers = {} } = {},
  ) {
    const h = {
      origin: "http://localhost:4174",
      "x-cuoi-da-request": "1",
      cookie,
      ...headers,
    };
    if (body && !(body instanceof FormData))
      h["content-type"] = "application/json";
    const res = await fetch(base + path, {
      method,
      headers: h,
      body:
        body instanceof FormData
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
    });
    const payload = res.headers
      .get("content-type")
      ?.includes("application/json")
      ? await res.json()
      : null;
    return {
      status: res.status,
      body: payload,
      cookie: res.headers.get("set-cookie")?.split(";")[0],
      headers: res.headers,
      res,
    };
  }
  async function register(email, nickname = "Người dùng") {
    return request("/api/auth/register", {
      method: "POST",
      body: { email, nickname, password: "valid-password-123" },
    });
  }
  return {
    db,
    app,
    base,
    request,
    register,
    dataDir,
    setTime: (t) => (clock = t),
    now: () => clock,
    close: async () => {
      await new Promise((r) => server.close(r));
      db.close();
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}
