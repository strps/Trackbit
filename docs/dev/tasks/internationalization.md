This implementation plan introduces internationalization (i18n) to **Trackbit** so the app can serve users in multiple languages with locale-aware date, number, and currency formatting. Today the codebase has zero i18n infrastructure: hard-coded English strings live in JSX, toasts, validation messages, email templates, backend error responses, and shared UI components. The user model lacks a locale or timezone column. This plan tackles those gaps in dependency order so each phase ships something usable on its own.

---

## **Stack Snapshot**

* **Frontend & Admin:** React 19 + Vite 7 + React Router 7, Zustand, TanStack Query
* **Backend:** Hono 4 + Drizzle ORM + better-auth, transactional emails via React Email + Resend
* **Shared:** `packages/ui` (Shadcn-derived components), `packages/types`, `packages/hacienda-client`
* **Existing locale code:** `Intl.DateTimeFormat().resolvedOptions().timeZone` for timezone detection only; `toLocaleString()` without explicit locale in analytics charts; `date-fns` used with ISO-only formats

---

## **Technical Implementation Plan**

### **Phase 1: Scope, Library Choice & Conventions**

* **In scope:** `apps/frontend` and the user-facing parts of `apps/backend` (API errors, transactional emails, better-auth messages).
* **Out of scope:** `apps/admin` stays English-only. It is internal staff tooling; the translation cost isn't justified. This is a hard boundary — no `t()` calls, no i18n setup in the admin app.
* **Launch languages:** English (`en`, source of truth) and Spanish (`es`). The plural/gender rules and string-length variance between these two are enough to exercise every layer of the system; adding more languages later only requires new JSON bundles.
* **Library: `react-i18next` + `i18next`.**
  * Mature, framework-agnostic core, plays well with React Router 7 SPA setup.
  * Supports lazy-loaded namespaces (essential for code-splitting per feature).
  * `i18next-browser-languagedetector` for first-visit detection from `navigator.language`.
  * `i18next-http-backend` (or static JSON imports) for loading bundles.
  * ICU MessageFormat support via `i18next-icu` for plurals/gender (recommended over the default suffix-based plural).
* **Alternative considered:** `FormatJS` / `react-intl`. Equally capable, ICU-native, but heavier API and the broader React community has settled on `react-i18next` for SPAs.
* **Key conventions:** All keys are written in English. Use a flat key per UI surface, namespaced by feature: `tracker.empty_state`, `auth.sign_in.title`, etc. Avoid full-sentence keys.
* **File layout:** `apps/frontend/src/i18n/locales/<lang>/<namespace>.json`. Shared strings used by `packages/ui` are passed in as props from the consuming app — `packages/ui` itself stays string-free (see Phase 6).

### **Phase 2: Data Layer — User Locale & Timezone**

Persist the user's preference so it survives sessions and powers backend-rendered text (emails).

* **Schema change** in [apps/backend/src/db/schema/app/user.ts](apps/backend/src/db/schema/app/user.ts):
  * Add `locale: text('locale').notNull().default('en')`.
  * Add `timezone: text('timezone').notNull().default('UTC')`.
* **Migration:** generate via Drizzle, backfill existing rows with `'en'` / `'UTC'`.
* **Better-auth additionalFields** in [apps/backend/src/lib/auth.ts](apps/backend/src/lib/auth.ts): expose `locale` and `timezone` so the session payload carries them to the client without an extra request.
* **API endpoint:** `PATCH /api/me/preferences` accepting `{ locale?, timezone? }`. Validate `locale` against the supported list (Phase 1).
* **Client capture on signup:** when a user account is created, send `navigator.language` and `Intl.DateTimeFormat().resolvedOptions().timeZone` so first-render is correct without a profile visit.

### **Phase 3: Frontend Bootstrapping**

Wire i18next into [apps/frontend](apps/frontend/src/) so the rest of the work has somewhere to land. (`apps/admin` is out of scope — Phase 1.)

* Create `src/i18n/index.ts` that initializes i18next with `['en', 'es']`, fallback `en`, and the ICU formatter.
* **No URL representation for locale.** `apps/frontend` is fully behind auth, so there is nothing public for search engines to index per-language and no shared-link scenario where path prefixes would pay off. URLs stay clean; language is a preference resolved on boot.
* **Resolution order** for the active language:
  1. `?lang=` query param if present (one-shot override — see below).
  2. User preference from session (Phase 2) once authenticated.
  3. `localStorage` (`trackbit.lang`) for unauthenticated visitors.
  4. `navigator.language`.
  5. `en`.
* **`?lang=` override:** read once on app mount, written into `localStorage` (and to the user record if authenticated), then stripped from the URL via `history.replaceState` so it doesn't survive navigation. Purpose: support staff send links like `/account?lang=es` to reproduce a user's bug report. This is the only URL-carries-language case Trackbit actually has.
* Wrap `<App />` in `<I18nextProvider>` (or rely on the default singleton — both work).
* Add a `<Suspense>` boundary at the route level so lazy-loaded namespaces don't block the first paint.
* **Locale switcher** component in the user nav next to the account menu — writes to `localStorage` and, if logged in, calls `PATCH /api/me/preferences`.

### **Phase 4: String Extraction (Frontend)**

Convert hard-coded JSX text to `t()` calls, one feature at a time so the diff stays reviewable. Suggested order, smallest blast radius first:

1. **Auth flows** — [SignIn.tsx](apps/frontend/src/features/auth/SignIn.tsx), sign-up, password reset, [AccountSettings.tsx](apps/frontend/src/features/auth/AccountSettings.tsx). Self-contained namespace `auth`.
2. **Navigation & shell** — [packages/ui/src/components/Header.tsx](packages/ui/src/components/Header.tsx) nav titles. Lift labels into props supplied by the consuming app (see Phase 6). Namespace `nav`.
3. **Tracker** — [TrackerHome.tsx](apps/frontend/src/features/tracker/TrackerHome.tsx) loading/empty/error states, "Anti-Habits" header, habit row labels. Namespace `tracker`.
4. **Habit configuration** — [HabitConfigForm.tsx](apps/frontend/src/features/habits-configuration/HabitConfigForm.tsx) tracking-type labels and descriptions, validation messages, [ColorThemeField.tsx](apps/frontend/src/features/habits-configuration/ColorThemeField.tsx) preset names. Namespace `habits`.
5. **Analytics** — [Analytics.tsx](apps/frontend/src/features/analytics/Analytics.tsx) and chart labels. Replace bare `toLocaleString()` with `i18n.language`-aware calls (Phase 5). Namespace `analytics`.
6. **Errors** — [Error.tsx](apps/frontend/src/features/errors/Error.tsx), toasts, route error fallbacks. Namespace `errors`.
7. **Issues / feedback modal** — already merged on this branch's parent; convert in the same pass. Namespace `issues`.

For each feature: extract strings, add the JSON entry under `locales/en/<namespace>.json`, keep an empty (or English-fallback) `locales/<lang>/<namespace>.json` for each target language so the bundles stay symmetric.

**Validation messages:** the form schemas (Zod by the look of it — confirm) need a `t`-aware error map. Define one in `src/i18n/zod.ts` that maps Zod issue codes to translation keys.

### **Phase 5: Locale-Aware Formatting**

* **Dates:** standardize on a `formatDate(d, style)` helper in `src/shared/utils/datetime.ts` that uses `Intl.DateTimeFormat(i18n.language, ...)`. Keep `date-fns` for arithmetic (`addDays`, `subDays`) but stop using `format()` for user-visible strings — `Intl` covers locale-aware output natively.
* **Numbers:** `formatNumber(n, opts)` wrapper around `Intl.NumberFormat`. Replace bare `toLocaleString()` calls in [VolumeChart.tsx](apps/frontend/src/features/analytics/components/VolumeChart.tsx), [MuscleChart.tsx](apps/frontend/src/features/analytics/components/MuscleChart.tsx).
* **Units:** for v1, treat the unit *label* (`kg`) as a translatable string only — no value conversion. A separate `unitSystem` user preference (`metric`/`imperial`) with actual conversion is a follow-up after v1, kept independent of locale because the metric/imperial split doesn't cleanly map to language (a US-based user may still log in Spanish; a UK user uses English with metric).
* **Plurals:** routes through ICU (e.g. `{count, plural, one {# habit} other {# habits}}`).

### **Phase 6: Shared UI Package**

`packages/ui` stays locale-agnostic. Both consumers (translated `apps/frontend`, English-only `apps/admin`) need to drive labels themselves.

* Audit components with hard-coded English: [Header.tsx](packages/ui/src/components/Header.tsx) nav titles, default labels in form components like [RpeSelector.tsx](packages/ui/src/components/RpeSelector.tsx).
* Pattern: every user-facing string must arrive as a prop. `apps/frontend` passes `t('nav.dashboard')`; `apps/admin` passes the literal English string.
* No i18next dependency in `packages/ui`.

### **Phase 7: Backend — Errors & Server-Rendered Text**

The backend produces user-visible strings in three places: API error responses, better-auth errors, and email templates. All three need `en` + `es`. Admin-only endpoints (under `routes/admin/`) can stay English-only — match the frontend split.

* **Locale resolution per request:** middleware that reads, in order:
  1. The session user's `locale` (Phase 2) once auth runs.
  2. `Accept-Language` header (negotiated against `['en', 'es']` with `en` fallback).
  Stores the resolved tag on the Hono context (`c.set('locale', ...)`).
* **Error catalog:** introduce `apps/backend/src/i18n/` with the same JSON-per-language layout as the frontend. Use `i18next` server-side (it runs fine in Node) or a thin custom lookup — the catalog is small enough that a hand-rolled `t(key, locale, vars)` is justified.
* **Refactor APIError sites:**
  * [apps/backend/src/lib/auth.ts:114-141](apps/backend/src/lib/auth.ts#L114-L141) (invitation code messages).
  * [apps/backend/src/routes/app/habits.ts:99](apps/backend/src/routes/app/habits.ts#L99), [:143](apps/backend/src/routes/app/habits.ts#L143) ("Habit not found").
  * Walk the rest of `routes/` for similar inline strings.
* **Better-auth localization:** better-auth supports custom error messages via its config; pull them from the catalog using the request locale.
* **Email templates** in [apps/backend/src/emails/](apps/backend/src/emails/):
  * Pass `locale` into the email render call from the auth/invite flows.
  * Replace hard-coded subjects (`"Verify your Trackbit account"`, `"Reset your Trackbit password"`) and bodies (`"Welcome to Trackbit!"`, etc. in [VerificationEmail.tsx](apps/backend/src/emails/VerificationEmail.tsx)) with catalog lookups.
  * Preview script (React Email already supports per-locale previews).

### **Phase 8: Translatable Domain Data — Exercises & Muscle Groups**

The [exercises](apps/backend/src/db/schema/app/exercises.ts) table holds two very different kinds of data in one place. The `userId IS NULL` rows are admin-curated system exercises; everything else is user-created. They need different strategies.

**Translatable fields (system data):**
* `exercises.name`, `exercises.description` (where `userId IS NULL`)
* `muscleGroups.name`, `muscleGroups.description` — fully system-managed

**Non-translatable (stable identifiers, translated client-side as labels):**
* `exercises.category` (`strength` / `cardio` / `flexibility`)
* `exerciseMuscleGroups.role` (`primary` / `secondary`)
* `defaultWeightUnit` / `defaultDistanceUnit` (these are unit codes, not display strings)

These are enum values, not user-visible strings — keep them as-is in the DB and translate the display labels via the i18n catalog (`exercise.category.strength`, `exercise.role.primary`, etc.).

#### **System exercises and muscle groups: JSONB i18n columns**

Add JSONB columns `name_i18n` and `description_i18n` to `exercises` and `muscle_groups`, shaped:

```json
{ "en": "Bench Press", "es": "Press de banca" }
```

Reads project the localized field with English fallback:

```sql
COALESCE(name_i18n->>$locale, name_i18n->>'en') AS name
```

This keeps the catalog hot-editable through the admin UI (no code deploy per new exercise), avoids a per-language schema migration when a third language is added, and doesn't introduce a separate translations table.

**Migration plan:**
* Add `name_i18n jsonb`, `description_i18n jsonb` to `exercises` and `muscle_groups`. Backfill existing `name`/`description` into the `en` slot.
* Update [apps/backend/src/routes/admin/exercises.ts](apps/backend/src/routes/admin/exercises.ts) — `exerciseBodySchema` accepts `name: { en: string, es?: string }` and same for `description`. Same change for [musclegroups.ts](apps/backend/src/routes/app/exercise-info/musclegroups.ts).
* Update [apps/backend/src/routes/app/exercise-info/exercises.ts](apps/backend/src/routes/app/exercise-info/exercises.ts) list query to project `COALESCE(name_i18n->>$locale, name_i18n->>'en')` as `name`, using the locale from the Phase 7 middleware. Frontend code rendering `exercise.name` then needs zero changes.
* Drop the existing `unique_user_exercise_name` constraint. Replace with a partial unique index on `(name_i18n->>'en')` scoped to system rows (`WHERE user_id IS NULL`).
* In the admin UI ([apps/admin/src/features/exercises/](apps/admin/src/features/exercises/)) the exercise edit form gets per-language `name` and `description` inputs (English required, Spanish optional with a "missing translation" warning). Same for the muscle-group editor.
* Drop the legacy `name`/`description` columns once all callers are migrated.

#### **User exercises: stored verbatim, never translated**

User exercise names are user data — stored as the user typed them, rendered verbatim regardless of UI language. This is how Strong, Hevy, and essentially every fitness app handles it. If a user switches their UI to a different language and wants their exercise renamed, they edit it themselves.

**No schema change for user rows.** The existing `name text` column stays as-is for `user_id IS NOT NULL`. Keep per-user uniqueness via a partial unique index on `(user_id, name) WHERE user_id IS NOT NULL`.

#### **Schema shape: one table, two storage modes**

Keep one `exercises` table. System rows (`user_id IS NULL`) populate `name_i18n` / `description_i18n`; user rows populate the plain `name` / `description`. The read layer picks whichever is non-null:

```sql
COALESCE(name_i18n->>$locale, name_i18n->>'en', name) AS name
```

`exerciseLogs.exerciseId` and every join stays uniform — no foreign-key refactor. Encapsulate the resolution SQL fragment in one helper used everywhere `exercises` is selected.

#### **Files affected**

* [apps/backend/src/db/schema/app/exercises.ts](apps/backend/src/db/schema/app/exercises.ts) — add JSONB columns to `exercises` and `muscleGroups`; replace unique constraint with two partial unique indexes.
* [apps/backend/src/routes/admin/exercises.ts](apps/backend/src/routes/admin/exercises.ts) — update validators and queries.
* [apps/backend/src/routes/app/exercise-info/exercises.ts](apps/backend/src/routes/app/exercise-info/exercises.ts) and [musclegroups.ts](apps/backend/src/routes/app/exercise-info/musclegroups.ts) — project localized name in list/get queries.
* [apps/admin/src/features/exercises/](apps/admin/src/features/exercises/) — per-language inputs on the form (admin app stays English-only for *its* UI strings; this is just exposing the data fields).
* `apps/frontend` — no changes if the backend projects a flattened `name` keyed by request locale. Otherwise add resolution at the call site.

### **Phase 9: Translation Workflow & CI**

* **English is hand-edited.** Spanish comes from an LLM-assisted bootstrap reviewed by a Spanish speaker on the team — the v1 string surface is small enough that a translation platform (Crowdin / Lokalise / Tolgee) is overkill until a third language is added.
* **CI lint:** a small script that walks every namespace's English JSON and verifies the same keys exist in `es` (missing → fail; extra → warn). Run in the existing CI pipeline.
* **Type safety:** generate `src/i18n/keys.d.ts` from the English bundles so `t()` autocompletes and typos break the build. `i18next` has a typed-keys helper for this.
* **Pseudo-locale (`en-XA`):** ship an automatically generated pseudo-translation (wraps each string in brackets, lengthens by 30%) that QA can switch to to spot un-extracted strings and layout overflow. Useful even with only two real languages because it surfaces missing keys without waiting for translation.

### **Phase 10: Rollout**

* **v1 ships `en` + `es` together.** No staged single-language rollout — the infrastructure is the work; the second language is mostly content.
* **Feature flag** on the language switcher: visible to admins first, then everyone.
* **Telemetry:** log selected locale on the issues/feedback events already wired up so usage informs whether/which third language to add later.
* **Docs:** add a "Translating Trackbit" section to `readme.md` covering namespace structure, key conventions, and how to run the CI lint locally.

