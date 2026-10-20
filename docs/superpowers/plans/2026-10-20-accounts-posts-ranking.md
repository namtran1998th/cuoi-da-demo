# Cười Đã Accounts and Weekly Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real email/password accounts, durable user-owned image/video posts, and weekly rankings to Cười Đã; deliver tested local server code on the existing GitHub repository.

**Architecture:** Add a self-contained `community/` application, preserving the static demo. Express serves its browser UI and API on one origin; node:sqlite stores records and a persistent data directory stores media. GitHub Pages and the existing Sites deployment remain static demos, not authentication backends.

**Tech Stack:** Node.js 24, Express, node:sqlite, node:crypto, streaming multipart upload middleware, FFprobe for validating media, node:test, Playwright. Resolve maintained dependency versions from official documentation during implementation; pin the resulting lockfile. No frontend framework or ORM.

**Spec:** `docs/superpowers/specs/2026-10-20-accounts-posts-ranking-design.md`

## Global Constraints

- Email + password and public nickname; no fake local-only authentication.
- Password 12–128 characters; nickname 2–40; title 1–180; comment 1–500.
- Image limit 2 MB; MP4/WebM video limit 50 MB. Interpret MB consistently as 1024 × 1024 bytes, as in the current demo.
- Sessions last 7 days. Public responses exclude email, password hashes, session tokens.
- Week is Monday 00:00 to next Monday 00:00 in Asia/Ho_Chi_Minh.
- Top 10 with score > 0; sidebar top 3; order by likes, distinct liked posts, then ascending user ID.
- No self-like score; toggling likes preserves the original timestamp; deleted posts do not rank.
- No automatic migration of local demo posts or votes. No automatic access-policy changes or paid hosting.
- Data, uploads, credentials and local environment files never enter GitHub.
- Email verification, email recovery and moderation are explicitly deferred; label the server an initial small-community version, not a public production launch.

## Review Focus

1. Two simultaneous registrations of the same normalized email: exactly one succeeds (Task 2).
2. Session expires while an upload runs: reject before publishing and clean up its temporary file (Task 3).
3. Repeated/parallel likes and a week boundary: idempotent count, no timestamp refresh (Task 4).
4. File write/database failure or process restart between stages: no visible broken post, safe retry cleanup (Task 3).
5. Navigation during pending fetches: stale responses never replace the newly selected view (Task 5).

## Files and boundaries

- `community/package.json`, lockfile, `.env.example`: Node runtime, dependencies, scripts and configuration names only.
- `community/server/index.mjs`: process startup, environment validation and shutdown.
- `community/server/app.mjs`: `createApp({db,dataDir,origin,secureCookies,now}) -> Express app`; no listening side effect, so tests use ephemeral ports.
- `community/server/db.mjs`, `migrations/001-initial.sql`: `openDatabase(file) -> DatabaseSync`, migrations, constraints and transactions.
- `community/server/auth.mjs`: password hashing, sessions, authentication routes and write-request protections.
- `community/server/media.mjs`, `posts.mjs`: file validation/lifecycle/streaming and owner-authorized post endpoints.
- `community/server/social.mjs`: likes, comments, bookmarks, profiles and ranking queries.
- `community/public/index.html`, `style.css`, `app.js`, `api.js`, `account.js`: UI adapted from `dist/`, fetch interface and account dialogs.
- `community/test/{auth,posts,social}.test.mjs`, `helpers.mjs`, `browser.cjs`: real HTTP/database integration tests plus browser acceptance.
- `community/scripts/backup.mjs`, `README.md`: consistent database/media backup and operating instructions.

Shared shapes: `UserPublic={id,nickname}`; `Me={id,email,nickname}` returned only to its owner; `Post={id,author:UserPublic,title,topic,media:{url,type,size},createdAt,likeCount,commentCount,liked,saved}`. JSON failures use `{error:{code,message}}`; list responses use `{items,nextCursor}`. Dates are ISO UTC; the database stores epoch milliseconds.

## Task 1 — Durable application boundary

**Files:** create package/config, app/startup/database/migration files and test helpers listed above. Add data/temp/upload paths to `.gitignore`; do not change `dist/`.

**Interfaces:** `openDatabase(file)` enables foreign keys, WAL and bounded busy timeout; applies numbered immutable migrations. `createApp(...)` exposes `GET /api/health -> {ok:true}` and serves `community/public`. `now()` defaults to `Date.now` and is injected into tests.

- [ ] Write `database survives reopening` and `migration is repeatable` in `community/test/auth.test.mjs`: insert a user, close/reopen, assert same ID; run migration twice, assert no duplicate schema or loss.
- [ ] Run `node --test community/test/auth.test.mjs`; confirm failure for missing implementation.
- [ ] Add tables from the spec with foreign keys, unique normalized email, unique like/bookmark pairs, indexes and a pending/ready/deleted state for posts. Add persistent rate-limit buckets keyed by hashed IP/account identifiers.
- [ ] Add startup requiring Node 24 and FFprobe; fail with actionable errors for missing runtime, unwritable data directory or invalid configured origin. Default local origin is `http://localhost:4174`; production requires explicit HTTPS origin and trusted proxy configuration, never arbitrary forwarded headers.
- [ ] Repeat tests; start server and verify health and static response; commit the working boundary.

## Task 2 — Accounts and sessions

**Files:** `server/auth.mjs`, `server/app.mjs`, `test/auth.test.mjs`.

**Interfaces:** `hashPassword(password) -> Promise<string>` uses built-in async scrypt with random salt and serialized parameters; `verifyPassword(password,encoded) -> Promise<boolean>`. `requireUser(req,res,next)` attaches the authenticated database user. Register/login/me/logout/change-password endpoints under `/api/auth`. Return `Me` only from owner endpoints.

- [ ] Add failing HTTP tests for registration, duplicate normalized email (including parallel requests), wrong password, invalid lengths, missing/expired session, logout and password change revoking all old sessions. Assert `Set-Cookie` has HttpOnly/SameSite and Secure in production, and database rows never contain plaintext passwords or raw cookie tokens.
- [ ] Run `node --test community/test/auth.test.mjs`; verify the new behavior fails.
- [ ] Implement email normalization as trim + lowercase, nickname trim and the exact length bounds. Validate email format without provider-specific alias rewriting. Registration creates a session; concurrent duplicate email is a controlled 409 response.
- [ ] Confirm scrypt parameters against current official security guidance, benchmark one hash on this runtime and cap concurrent hashing before expensive work. Store parameters/salt with each hash and compare derived keys timing-safely. Use 32-byte random session tokens, store only SHA-256 token hashes, expire after exactly 7 days.
- [ ] Implement source validation for every write: require matching Origin and `X-Cuoi-Da-Request: 1`, reject cross-site fetch metadata. Limit login attempts to 10/15 minutes per hashed IP and normalized email, registration to 5/hour/IP, and password changes to 5/15 minutes/user; return 429 with Retry-After. Run equivalent hash work for unknown accounts and return the same invalid-login error.
- [ ] Run tests; add origin/CSRF, spoofed forwarding and rate-limit assertions. Commit when all pass.

## Task 3 — Posts and persistent media

**Files:** `server/media.mjs`, `server/posts.mjs`, `server/app.mjs`, `test/posts.test.mjs`, media fixtures.

**Interfaces:** `validateMedia(filePath,declaredType) -> Promise<{type,size}>`; `GET/POST /api/posts`, `GET/PATCH/DELETE /api/posts/:id`, `GET /media/:key`. `GET /api/posts` accepts tab hot/new/top, topic, query, author and cursor, with 20 items/page and maximum 50. Private saved list requires a session.

- [ ] Write failing tests that upload real PNG and WebM as user A, reopen the database/server, and read them as user B. Assert B cannot patch/delete A's post, anonymous writes return 401, Range requests return 206 and correct bytes.
- [ ] Add wrong MIME, malformed media, zero bytes, image >2 MB/video >50 MB, path traversal, extra multipart files, missing fields and session expiry during upload tests. Assert no ready post or orphan temporary file remains after rejected uploads.
- [ ] Run `node --test community/test/posts.test.mjs` and observe expected failures.
- [ ] Stream one file into a server-generated temporary path with hard multipart limits and upload rate limit 10/hour/user. Spawn FFprobe with an argument array, timeout, bounded output and restricted protocols; compare detected container/streams with the image/video allowlist, not just extension or browser MIME. No HTML/SVG upload support.
- [ ] Revalidate session before publication. Use a pending row, atomic rename into the media directory, then mark ready. Startup reconciliation removes expired pending files/rows and retries deleted-media cleanup; list/detail/media queries only expose ready posts. Inject filesystem failure in tests to prove rollback/reconciliation.
- [ ] Author ID always comes from the session. Validate title/topic server-side, whitelist editable fields, soft-delete before file cleanup and exclude deleted posts everywhere. Serve media with correct content type, nosniff, Range and no executable content. Use cursor pagination with an ID tiebreaker; hot orders by recent effective likes, new by creation, top by total likes.
- [ ] Run post and auth suites; commit verified post/media behavior.

## Task 4 — Social actions and weekly ranking

**Files:** `server/social.mjs`, `server/app.mjs`, `test/social.test.mjs`.

**Interfaces:** `PUT /api/posts/:id/like {active:boolean}` and `/bookmark {active:boolean}` are idempotent; `GET/POST /api/posts/:id/comments`; `GET /api/profiles/:id`; `GET /api/leaderboard`. `weekBounds(nowMs) -> {start,end}` uses the Vietnam week and a half-open interval.

- [ ] Add failing tests for 20 parallel identical likes contributing one point, unlike/re-like retaining first timestamp, self-like rejection, comments requiring auth, public profile hiding email and saved lists scoped to the owner.
- [ ] Assert `weekBounds(Date.parse('2026-10-18T17:00:00Z'))` returns start `2026-10-18T17:00:00Z`, end `2026-10-25T17:00:00Z`; the millisecond before start belongs to the previous week. Add deletion, week-empty, zero-score omission and all tiebreakers.
- [ ] Run `node --test community/test/social.test.mjs`; confirm failures before implementing.
- [ ] Implement unique-row updates preserving `first_liked_at`, parameterized queries and leaderboard aggregation over active eligible likes. Return a top-10 list with score, distinctPostCount and public author; include start/end for the UI date label. Enforce 1–500 character comments, paginated comments, server-generated authors and a limit of 30 comments/10 minutes/user.
- [ ] Run all backend tests. Commit after confirming no count inflation or private-data leakage.

## Task 5 — Browser UI connected to accounts

**Files:** `community/public/*`, `test/browser.cjs`; reuse the existing static demo's styles and content structure, not its fake counts or local data layer.

**Interfaces:** `api(path,{method,body,signal}) -> Promise<JSON>` sends same-origin credentials and the write header; throws structured errors. UI supports `/`, `/posts/:id`, `/profiles/:id`, `/me/posts`, `/saved`, `/leaderboard`. Server serves the UI shell for these paths while preserving API/media 404s.

- [ ] Write browser acceptance with two isolated contexts: register A and B, A posts a video, B views and likes it, A sees its real score; B cannot see edit/delete controls on A's post. Reload both contexts and restart server before rechecking persisted data.
- [ ] Add empty-feed/ranking states, login-required actions, change-password/logout, expired-session upload, failed fetch retry, escaped HTML and stale response after navigation tests. Assert mobile width 390 has no horizontal overflow; dialogs are keyboard accessible and restore focus.
- [ ] Run browser test against the server at port 4174 and confirm missing UI behavior fails.
- [ ] Adapt the existing layout and add account forms, own-post actions, profiles, ranked list and paginated feed. Use textContent/escaped templates, abort stale requests, upload via XMLHttpRequest for progress, disable duplicate submissions, and leave files selected on a recoverable upload failure.
- [ ] Label email as unverified; explain that email recovery is not yet available. Show no fake ranking members or seed votes. Use the native share dialog/copy link, with origin-based post URLs; no automatic network posting.
- [ ] Run acceptance plus backend suites, inspect desktop/mobile screenshots and video playback. Commit only after functional and visual checks pass.

## Task 6 — Backup, GitHub delivery and operating instructions

**Files:** `community/scripts/backup.mjs`, `community/README.md`, root README, `.gitignore`, `.env.example`, migration/lockfiles and test fixtures.

**Interfaces:** `npm start` runs the community server; `npm test` runs node:test suites; `npm run test:browser` runs acceptance. Config names: PORT, APP_ORIGIN, DATA_DIR, NODE_ENV, TRUST_PROXY and FFPROBE_PATH; document values and defaults, no secrets. Backup requires clean server shutdown and copies the closed database plus media directory to an explicitly selected external path.

- [ ] Add an operational test: stop server, back up, restore into a temporary directory, restart and verify accounts, media, likes and ranking. Reject a backup path inside the live data directory and avoid overwriting existing backups.
- [ ] Implement the backup command and document Node/FFprobe installation, clean setup, migrations, HTTPS/proxy configuration, persistence, backup/restore and the email/moderation limitations.
- [ ] Perform one clean installation with the lockfile and run all checks. Scan staged files for data directories, environment values, credentials and user media; exclude generated screenshots and caches.
- [ ] Inspect current GitHub repository state before publishing. Preserve root files serving GitHub Pages; add the backend under `community/` and design/plan documents under `docs/`. Do not overwrite changes the user made on GitHub or publish a separate conflicting history. If browser upload is used, verify the nested paths and commit contents in the GitHub UI.
- [ ] Review the entire change for authentication bypass, ownership mistakes, persistence and week-boundary bugs; address findings and rerun affected tests.
- [ ] Verify GitHub commit/file listing and provide repository plus local startup instructions. State explicitly that GitHub Pages is still the static demo. Do not claim online account support without a real backend deployment.

## Self-review

Coverage checked against every spec section: accounts and sessions (2); media, ownership and persistence (1/3); comments/bookmarks/ranking (4); profiles, dialogs and navigation (5); backups, source delivery and hosting limits (6). Review Focus cases are assigned to their owning tasks. This plan intentionally stops short of acquiring paid hosting or changing the existing website's access policy.

## Execution choice

Recommended: implement directly in this chat, task by task, with a final independent review. The tasks share the same database, session middleware and API contract, so sequential implementation minimizes coordination overhead. Alternate: task-by-task implementation/review by subagents. Await the user's review of this plan and execution choice before writing application code.
