import test from "node:test";
import assert from "node:assert/strict";
import { digest } from "../server/common.mjs";
import { fixture } from "./helpers.mjs";
test("accounts normalize email, protect secrets, revoke sessions and enforce expiry", async () => {
  const f = await fixture();
  try {
    const a = await f.register(" Alice@Example.com ", "Alice");
    assert.equal(a.status, 201);
    assert.ok(a.cookie);
    assert.match(a.headers.get("set-cookie"), /HttpOnly/);
    assert.match(a.headers.get("set-cookie"), /SameSite=Lax/);
    assert.equal(
      (await f.request("/api/auth/me", { cookie: a.cookie })).body.email,
      "alice@example.com",
    );
    assert.equal((await f.register("alice@example.com")).status, 409);
    const bad = await f.request("/api/auth/login", {
      method: "POST",
      body: { email: "alice@example.com", password: "wrong-password-123" },
    });
    assert.equal(bad.status, 401);
    const row = f.db.prepare("SELECT * FROM users").get();
    assert.ok(!row.password_hash.includes("valid-password"));
    assert.ok(
      !JSON.stringify(f.db.prepare("SELECT * FROM sessions").all()).includes(
        a.cookie.split("=")[1],
      ),
    );
    const login = await f.request("/api/auth/login", {
      method: "POST",
      body: { email: "alice@example.com", password: "valid-password-123" },
    });
    assert.equal(login.status, 200);
    const change = await f.request("/api/auth/change-password", {
      method: "POST",
      cookie: a.cookie,
      body: {
        currentPassword: "valid-password-123",
        password: "new-password-456",
      },
    });
    assert.equal(change.status, 200);
    assert.equal(
      (await f.request("/api/auth/me", { cookie: login.cookie })).status,
      401,
    );
    f.setTime(f.now() + 7 * 86400000);
    assert.equal(
      (await f.request("/api/auth/me", { cookie: change.cookie })).status,
      401,
    );
  } finally {
    await f.close();
  }
});
test("parallel registration, validation, CSRF and rate limiting", async () => {
  const f = await fixture();
  try {
    const results = await Promise.all([
      f.register("dupe@example.com"),
      f.register("DUPE@example.com"),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    assert.equal(
      (
        await f.request("/api/auth/register", {
          method: "POST",
          body: { email: "bad", nickname: "X", password: "short" },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await f.request("/api/auth/login", {
          method: "POST",
          headers: { origin: "https://evil.example" },
          body: {},
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await f.request("/api/auth/login", {
          method: "POST",
          headers: { "x-cuoi-da-request": "" },
          body: {},
        })
      ).status,
      403,
    );
    for (let i = 0; i < 10; i++)
      await f.request("/api/auth/login", {
        method: "POST",
        body: { email: "unknown@example.com", password: "bad-password-123" },
      });
    const limited = await f.request("/api/auth/login", {
      method: "POST",
      headers: { "x-forwarded-for": "1.2.3.4" },
      body: { email: "another@example.com", password: "bad-password-123" },
    });
    assert.equal(limited.status, 429);
  } finally {
    await f.close();
  }
});

test("in-flight authentication cannot restore revoked credentials or sessions", async () => {
  const f = await fixture();
  try {
    const account = await f.register("race@example.com");
    const login = f.request("/api/auth/login", {
      method: "POST",
      body: { email: "race@example.com", password: "valid-password-123" },
    });
    while (
      !f.db
        .prepare("SELECT 1 FROM rate_limits WHERE key=?")
        .get(digest("login-email:race@example.com"))
    )
      await new Promise((resolve) => setTimeout(resolve, 5));
    // Simulate a completed password change while scrypt is in flight.
    f.db.prepare("UPDATE users SET password_hash=?").run("revoked");
    assert.equal((await login).status, 401);
    const other = await f.register("logout-race@example.com");
    const change = f.request("/api/auth/change-password", {
      method: "POST",
      cookie: other.cookie,
      body: {
        currentPassword: "valid-password-123",
        password: "replacement-password-456",
      },
    });
    while (
      !f.db
        .prepare("SELECT 1 FROM rate_limits WHERE key=?")
        .get(digest("password:" + other.body.id))
    )
      await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(
      (
        await f.request("/api/auth/logout", {
          method: "POST",
          cookie: other.cookie,
        })
      ).status,
      200,
    );
    assert.equal((await change).status, 401);
  } finally {
    await f.close();
  }
});
