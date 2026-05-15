This implementation plan introduces a **comprehensive end-to-end testing suite** to Trackbit. The repo currently ships with zero automated tests — no unit, integration, or e2e coverage exists anywhere in `apps/` or `packages/`. Every regression is caught manually, which has already cost time on the role-limits, i18n, and bug-tracker work. The goal of this task is to land a maintainable e2e harness that exercises the real frontend against the real backend against a real PostgreSQL, with seeded users, deterministic state, and CI integration — so that future feature work (Hacienda, analytics expansions, mobile responsiveness) can be merged with confidence.

---

## **Stack Snapshot**

* **Frontend:** React 19 + Vite 7 + React Router 7 (SPA, no SSR), TanStack Query, Zustand.
* **Backend:** Hono 4 + Drizzle ORM + Better-Auth + PostgreSQL.
* **Admin:** Separate React app on its own origin, talking to the same backend with admin-only CORS.
* **Shared:** `packages/ui`, `packages/types`, `packages/hacienda-client`.
* **Existing test infrastructure:** None. No `vitest.config.*`, no `playwright.config.*`, no `__tests__/` directories. The `i18n-lint` script in `package.json` is a JSON parity check, not a test runner.

---

## **Technical Implementation Plan**

### **Phase 1: Tooling Choice & Scope**

* **Library: Playwright.**
  * True browser-driven e2e (Chromium + Firefox + WebKit) — matches how users actually hit Trackbit.
  * First-class TypeScript support, parallel workers, trace viewer, video/screenshot on failure.
  * Built-in test isolation per worker (separate storage state, cookies).
  * Network interception and request mocking when needed (e.g. Resend email capture).
  * Plays well with Vercel preview deployments — same tests can run against `localhost` in CI and a preview URL on PRs.
* **Alternatives considered:**
  * *Cypress* — comparable ergonomics but single-browser-tab model makes multi-origin testing (frontend ↔ admin ↔ backend) awkward, and the runner's iframe sandboxing fights with Better-Auth's cookie domain handling.
  * *Vitest + jsdom + MSW* — fine for component-level tests, but the user asked for an **end-to-end** suite. Add unit/integration tests as a follow-up; keep this task focused.
* **Scope of "end-to-end":**
  * Real PostgreSQL (test database, see Phase 2).
  * Real backend process spawned by the test runner.
  * Real frontend and admin Vite dev servers (or built `dist/` served via `vite preview`).
  * Stubbed external services only where there's no other option: Resend (email send), Hacienda sandbox (when Phase 7 lands).
* **Out of scope for this task:**
  * Visual regression testing (Chromatic / Percy). Defer until the UI stabilizes post-i18n.
  * Load testing (k6, Artillery). Different problem, different tooling.
  * Unit tests for `packages/types` and `packages/ui` — out of scope for an *e2e* suite, but worth a follow-up backlog item.

### **Phase 2: Test Database & Backend Harness**

The hardest part of e2e is reproducible state. Trackbit's domain is heavily relational (habits → dayLogs → exerciseSessions → exerciseLogs → exercisePerformances) and timezone-sensitive (`/api/tracker/history`), so flaky data setup will kill the suite. Solve this first.

* **Dedicated test database:** `trackbit_test` Postgres role/db, separate from `trackbit_dev`. Connection string lives in `apps/backend/.env.test` and is loaded when `NODE_ENV=test`.
* **Schema reset strategy:** before the test run starts, `drizzle-kit push` the current schema into the test DB. Do **not** run migrations one-by-one in tests — that doubles the maintenance surface every time a schema change lands. The test DB is a snapshot of the current schema, not a historical replay.
* **Per-test isolation:** wrap each test in a database transaction that rolls back on teardown, OR truncate all tables between tests. Choose truncation — Better-Auth's session creation, the rate limiter, and any future job queue all interact with the DB in ways that may not honor an outer transaction. A `TRUNCATE ... RESTART IDENTITY CASCADE` over the user-data tables (skip enum/system tables) is fast on an empty DB and bulletproof.
* **Seeding helpers:** `apps/backend/src/test/seed.ts` exposes factory functions:
  * `seedUser({ role?, locale?, timezone? }) → { user, sessionCookie }`
  * `seedHabit({ userId, type, ... }) → habit`
  * `seedExerciseSession({ userId, habitId, performances: [...] }) → session`
  * `seedAdmin()` returns a user with `role: 'admin'` and pre-loaded session cookie for the admin app.
  * Factories use sensible defaults so a test only has to specify what it cares about.
* **Backend lifecycle in tests:** Playwright's `webServer` config option spawns `pnpm --filter backend dev` with `NODE_ENV=test` before the suite and tears it down after. Same for `pnpm --filter frontend dev` and `pnpm --filter admin dev`. Three concurrent dev servers on three known ports (e.g. 3000 backend, 5173 frontend, 5174 admin).
* **Email capture:** stub Resend by setting `RESEND_API_KEY=test` and routing through a local catcher (`@react-email/preview-server` or a tiny Hono route in test mode that stores emails in memory and exposes `GET /test/emails`). Tests that need to assert "invite email was sent" hit that endpoint.

### **Phase 3: Playwright Project Setup**

* New top-level directory: `tests/e2e/` (sibling of `apps/`, not nested inside an app — it spans frontend, admin, and backend).
* Add `tests/e2e/package.json` with `@playwright/test` as the only runtime dep; wire into the workspace via `pnpm-workspace.yaml`.
* Root scripts in the monorepo `package.json`:
  * `test:e2e` — runs the full suite headless.
  * `test:e2e:ui` — opens Playwright's UI mode for local debugging.
  * `test:e2e:debug` — `PWDEBUG=1` with the inspector.
* `playwright.config.ts`:
  * Three projects: `frontend`, `admin`, `cross-app` (tests that span both).
  * `webServer` array spawning backend, frontend, and admin dev servers with `reuseExistingServer: !process.env.CI`.
  * `retries: 2` in CI, `0` locally.
  * `trace: 'on-first-retry'`, `video: 'retain-on-failure'`, `screenshot: 'only-on-failure'`.
  * Workers: `process.env.CI ? 2 : undefined` — start conservative, scale up once the suite proves stable.
* **Auth setup pattern:** use Playwright's [storage state](https://playwright.dev/docs/auth) mechanism. A `auth.setup.ts` runs once, seeds a known user via the backend's test API, logs in, and saves the cookie to `playwright/.auth/user.json`. Tests load that storage state instead of re-running the signin flow on every test — except for the auth tests themselves, which run unauthenticated.
* **Test API surface:** a small `apps/backend/src/routes/test/*` module, mounted **only when `NODE_ENV=test`**, exposes endpoints for seeding and DB reset that tests call directly (`POST /test/reset`, `POST /test/seed/user`, `GET /test/emails`). This is the single biggest force-multiplier — keep it gated and never let it ship to production.

### **Phase 4: Critical Path Coverage (Frontend)**

Cover the flows that, if they regress, make the product unusable. Order by blast radius.

1. **Auth flows** — sign up (with and without invite code), sign in, sign out, password reset (asserts on the captured email), session persistence after reload, `?lang=` override behavior (see Phase 6).
2. **Tracker home** — empty state for a fresh user, log a `count` habit, log a `check` habit, log a `timed` habit (start/stop the timer), log a `complex` habit (open session → add exercise → add performance → save), log a `negative` habit, view history for prior days, timezone correctness (seed user in `America/Costa_Rica`, assert day boundaries align).
3. **Habit configuration** — create one habit of each type with all required fields, edit each, archive/freeze each, attempt to create one beyond the role cap and assert the limit error code surfaces in the UI ([[project_role_limits_freeze]] — the consumer frontend was flagged as still needing this; the test should fail until that work lands).
4. **Exercise library** — create a user exercise, attach muscle groups, edit, delete; verify system exercises are read-only.
5. **Sessions & performance logging** — full workout flow: create session → log multiple exercises → log sets with reps/weight/RPE → mark PRs → save → reopen and edit.
6. **Analytics** — seed a user with two months of sessions across three exercises, navigate to analytics, assert each chart (`ExerciseChart`, `VolumeChart`, `MuscleGroupBreakdown`) renders with non-empty data and respects the time-range filter.
7. **Bug tracker / feedback** — open the global feedback modal, submit a bug, verify it appears in the backend's `issues` table via the admin app (see Phase 5).
8. **Error boundary** — force a route-level crash (test-only `/crash` route gated by `NODE_ENV=test`), confirm the error page captures the stack and submits it through the feedback flow.

### **Phase 5: Admin App Coverage**

The admin app's CORS, role enforcement, and limits configuration are easy to break and hard to notice without testing.

1. **Auth boundary** — a non-admin user is rejected at `/admin/*`; an admin user is accepted. Assert at both the API layer (direct `fetch` from a Playwright request context) and the UI layer (admin app refuses to render protected routes for a non-admin session).
2. **Invitations** — create invite as admin, copy code, log out, sign up as a new user with that code, verify the invite is marked used.
3. **User management** — list users, change a user's role, change their limits, freeze/unfreeze a user's resources. Assert the change is reflected in a consumer-app session (sign in as that user in a second browser context).
4. **Issues triage** — submit an issue from the frontend (Phase 4 step 7), open it in the admin app, change status `open → resolved`, verify the consumer side reflects nothing (issues are write-only for users).
5. **Limits enforcement (retroactive freeze)** — admin lowers a user's habit cap below their current count; verify the user's existing habits beyond the cap become frozen, and that the user gets the documented error code when trying to log against a frozen habit ([[project_role_limits_freeze]]).

### **Phase 6: i18n Coverage**

The i18n work ([[project_i18n_phase1]] through [[project_i18n_phase6]]) is largely complete on the frontend and backend, with the admin app intentionally English-only. Lock that in.

* **Bundle parity** — keep the existing `pnpm i18n:lint` script and run it as a test gate (Playwright `globalSetup` or a separate CI step). A missing translation key for `es` should fail CI, not just nag.
* **Resolution order** — for each step in the Phase-3 i18n resolution chain (`?lang=` → session → `localStorage` → `navigator.language` → `en`), write a test that primes only that input and asserts the active language. Catches regressions in the precedence logic.
* **Locale switcher** — switch to `es` via the UserNav `Globe` icon, reload, assert persistence; sign out and sign back in, assert it still comes back from the user record.
* **Locale-aware formatting** — seed analytics data and assert that `VolumeChart` and `MuscleChart` axis labels use `es-CR` number formatting when the active locale is `es`.
* **Admin stays English** — assert that no `t()` calls or translation files exist under `apps/admin/`; this is a hard architectural boundary per [[project_i18n_conventions]]. Implement as a static check (grep step in CI), not a runtime test.

### **Phase 7: Hacienda Integration (Deferred Hook)**

`packages/hacienda-client` is WIP and the BACKLOG flags upcoming work (additional document types, CAByS auto-updates, contingency mode). Don't try to e2e-test against the real Hacienda sandbox in CI — it's flaky, rate-limited, and credential-bound.

* **Strategy:** record a set of representative request/response pairs from the sandbox using Playwright's request interception, replay them in tests. Refresh the recordings whenever the v4.4 schema changes.
* **Coverage when the integration lands:** happy-path invoice submission, validation error path, network-failure / contingency-mode path. One test per document type once Phase 2 of the Hacienda task ships.
* **Gate:** this phase is a placeholder. Don't block the rest of the e2e suite on it.

### **Phase 8: CI Integration**

* **Where:** add a `e2e` job to the existing CI pipeline (likely GitHub Actions, given the Vercel deployment target — confirm before implementing).
* **Services:** GitHub Actions service container for `postgres:16-alpine`. Set `DATABASE_URL` to point at it; `drizzle-kit push` on job start to seed the schema.
* **Caching:** cache `node_modules` via pnpm store path, cache Playwright browsers via `~/.cache/ms-playwright`. Both shave several minutes off cold runs.
* **Artifacts on failure:** upload Playwright's `test-results/` (videos, traces, screenshots) as a job artifact so a failing PR has clickable evidence.
* **PR gating:** required check on `main`. Failing e2e blocks merge. Allow `workflow_dispatch` so the suite can be re-run without a fresh push.
* **Preview-deployment runs:** add a follow-up workflow that, on Vercel preview deploy ready, runs a smoke-test subset (auth + tracker happy path only) against the preview URL. Full suite stays on the local-dev-server target — preview URLs share a database, which breaks the per-test reset assumption.
* **Performance budget:** target under 8 minutes for the full suite in CI. If it grows past that, shard by project (frontend vs admin) before adding workers blindly.

### **Phase 9: Documentation & Maintenance**

* **`tests/e2e/README.md`** — how to run locally, how to debug a failing test, how to add a new test (factory usage, storage-state pattern, what *not* to mock).
* **Update `AGENTS.md`** under "Build and Test" with the new `test:e2e` scripts.
* **Update `readme.md`** with a one-line CI badge and a pointer to the e2e docs.
* **Flake policy:** any test that fails twice in a week on `main` gets quarantined (skipped with a tracking issue) within 24h. A flaky suite trains the team to ignore CI, which is worse than no suite at all.
* **Ownership:** the person who lands a feature lands its e2e test in the same PR. Don't accumulate "tests TODO" debt — that's how the suite ends up frozen in time and stops catching regressions.

---

## **Open Questions**

1. **CI platform** — is the project actually on GitHub Actions, or somewhere else? Phase 8 assumes Actions; confirm before wiring the workflow.
2. **Test DB lifecycle in CI** — service container per job vs. ephemeral Neon branch. Service container is simpler; Neon branching gives faster cold starts if the team already uses Neon in prod.
3. **Email provider in test** — accept the in-memory catcher described in Phase 2, or invest in a Mailpit container for a more realistic SMTP path? The catcher is enough until the email surface grows beyond auth + invites.
4. **Mobile coverage** — Playwright can emulate mobile viewports cheaply. Worth adding a single `mobile-smoke` project once the BACKLOG "Mobile-responsive optimizations for tracker pages" item is picked up, but not before — testing a UI we know is non-responsive just produces noise.
