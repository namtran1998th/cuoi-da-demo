const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
(async () => {
  const { openDatabase } = await import("../server/db.mjs"),
    { createApp } = await import("../server/app.mjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cuoi-browser-"));
  let db, server, browser;
  const origin = "http://localhost:4176";
  async function start() {
    db = openDatabase(path.join(dir, "community.sqlite"));
    const app = createApp({ db, dataDir: dir, origin, secureCookies: false });
    server = app.listen(4176);
    await new Promise((r) => server.once("listening", r));
  }
  async function stop() {
    await new Promise((r) => server.close(r));
    db.close();
  }
  try {
    await start();
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const ca = await browser.newContext(),
      cb = await browser.newContext(),
      a = await ca.newPage(),
      b = await cb.newPage();
    a.setDefaultTimeout(10000);
    b.setDefaultTimeout(10000);
    const errors = [];
    for (const p of [a, b]) p.on("pageerror", (e) => errors.push(e.message));
    async function register(p, email, nick) {
      await p.goto(origin);
      await p.getByRole("button", { name: "Đăng nhập", exact: true }).click();
      await p
        .getByRole("button", { name: "Tạo tài khoản", exact: true })
        .click();
      await p.getByLabel("Email", { exact: true }).fill(email);
      await p.getByLabel("Biệt danh", { exact: true }).fill(nick);
      await p
        .getByLabel("Mật khẩu", { exact: true })
        .fill("valid-password-123");
      await p.locator("#account-submit").click();
      await p.locator("#account-dialog").waitFor({ state: "hidden" });
    }
    await register(a, "a@example.com", "Cây hài A");
    await register(b, "b@example.com", "Cây hài B");
    await a.locator("#upload").click();
    await a.getByLabel("Tiêu đề", { exact: true }).fill("Video từ tài khoản A");
    await a
      .locator("input[type=file]")
      .setInputFiles(path.resolve(__dirname, "fixtures/flower.webm"));
    await a.locator("#media-preview video").waitFor({ state: "visible" });
    await a.locator("#post-submit").click();
    await a.locator(".post video").waitFor();
    assert.equal(await a.locator(".post video").getAttribute("autoplay"), null);
    await b.reload();
    await b.locator(".post video").waitFor();
    await b.locator(".post video").evaluate((v) => v.play());
    assert.equal(await b.locator("[data-action=edit]").count(), 0);
    await b.locator("[data-action=like]").click();
    await b.waitForFunction(
      () =>
        document
          .querySelector("[data-action=like]")
          ?.getAttribute("aria-pressed") === "true",
    );
    await a.reload();
    await a
      .locator("#ranking")
      .getByText("Cây hài A", { exact: true })
      .waitFor({ timeout: 4000 });
    await stop();
    await start();
    await b.reload();
    await b.locator(".post video").waitFor();
    assert.equal(
      await b.locator("[data-action=like]").getAttribute("aria-pressed"),
      "true",
    );
    await b.locator("[data-action=comment]").click();
    await b.getByLabel("Viết bình luận").fill("<b>Rất vui</b>");
    await b.locator(".comment-form button").click();
    await b.getByText("<b>Rất vui</b>", { exact: true }).waitFor();
    await a.setViewportSize({ width: 390, height: 844 });
    await a.screenshot({
      path: path.join(__dirname, "../test-output/mobile.png"),
      fullPage: true,
    });
    assert.ok(
      await a.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await a.setViewportSize({ width: 1440, height: 1000 });
    await a.screenshot({
      path: path.join(__dirname, "../test-output/desktop.png"),
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      "PASS browser: two accounts, upload, playback, like, ranking, persistence after restart, ownership UI, escaped comments, responsive layout.",
    );
  } finally {
    if (browser) await browser.close();
    if (server?.listening) await stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
