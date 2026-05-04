This implementation plan introduces internationalization (i18n) to **Trackbit** so the app can serve users in multiple languages with locale-aware date, number, and currency formatting. Today the codebase has zero i18n infrastructure: hard-coded English strings live in JSX, toasts, validation messages, email templates, backend error responses, and shared UI components. The user model lacks a locale or timezone column. This plan tackles those gaps in dependency order so each phase ships something usable on its own.

---

## **Stack Snapshot**

* **Frontend & Admin:** React 19 + Vite 7 + React Router 7, Zustand, TanStack Query
* **Backend:** Hono 4 + Drizzle ORM + better-auth, transactional emails via React Email + Resend
* **Shared:** `packages/ui` (Shadcn-derived components), `packages/types`, `packages/hacienda-client`
* **Existing locale code:** `Intl.DateTimeFormat().resolvedOptions().timeZone` for timezone detection only; `toLocaleString()` without explicit locale in analytics charts; `date-fns` used with ISO-only formats

---

## **Technical Implementation Plan**

### **Phase 1: Library Choice & Conventions**

Pick one library for both `apps/frontend` and `apps/admin` to keep the mental model consistent.

* **Recommendation: `react-i18next` + `i18next`.**
  * Mature, framework-agnostic core, plays well with React Router 7 SPA setup.
  * Supports lazy-loaded namespaces (essential for code-splitting per feature).
  * `i18next-browser-languagedetector` for first-visit detection from `navigator.language`.
  * `i18next-http-backend` (or static JSON imports) for loading bundles.
  * ICU MessageFormat support via `i18next-icu` for plurals/gender (recommended over the default suffix-based plural).
* **Alternative considered:** `FormatJS` / `react-intl`. Equally capable, ICU-native, but heavier API and the broader React community has settled on `react-i18next` for SPAs.
* **Source-of-truth language:** `en` (US English). All keys are written in English. Use a flat key per UI surface, namespaced by feature: `tracker.empty_state`, `auth.sign_in.title`, etc. Avoid full-sentence keys.
* **File layout:** `apps/frontend/src/i18n/locales/<lang>/<namespace>.json`, mirrored in `apps/admin`. Shared strings used by `packages/ui` are passed in as props from the consuming app — `packages/ui` itself stays string-free (see Phase 6).

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

Wire i18next into [apps/frontend](apps/frontend/src/) and [apps/admin](apps/admin/src/) so the rest of the work has somewhere to land.

* Create `src/i18n/index.ts` that initializes i18next with the supported language list, fallback `en`, and the ICU formatter.
* **Resolution order** for the active language:
  1. User preference from session (Phase 2) once authenticated.
  2. `localStorage` (`trackbit.lang`) for unauthenticated visitors.
  3. `navigator.language`.
  4. `en`.
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
* **Units:** weight unit (`kg`) is currently hard-coded next to numbers. Decide: (a) translate the unit string only, or (b) add a `unitSystem` user preference (`metric`/`imperial`) and convert values. Recommend (a) for v1, (b) as a follow-up.
* **Plurals:** routes through ICU (e.g. `{count, plural, one {# habit} other {# habits}}`).

### **Phase 6: Shared UI Package**

`packages/ui` should remain locale-agnostic so it can be reused by `apps/admin` (which may have a different default language for staff).

* Audit components with hard-coded English: [Header.tsx](packages/ui/src/components/Header.tsx) nav titles, default labels in form components like [RpeSelector.tsx](packages/ui/src/components/RpeSelector.tsx).
* Pattern: every user-facing string must arrive as a prop. The consuming app passes `t('nav.dashboard')` etc.
* No i18next dependency in `packages/ui`.

### **Phase 7: Backend — Errors & Server-Rendered Text**

The backend produces user-visible strings in three places: API error responses, better-auth errors, and email templates.

* **Locale resolution per request:** middleware that reads, in order:
  1. `Accept-Language` header.
  2. The session user's `locale` (Phase 2) once auth runs.
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

### **Phase 8: Translation Workflow & CI**

* **Source language only is hand-edited.** Other locales come from a translation tool (Crowdin / Lokalise / Tolgee) or LLM-assisted bootstrap reviewed by a human.
* **CI lint:** a small script that walks every namespace's English JSON and verifies the same keys exist in each target language (missing → fail; extra → warn). Run in the existing CI pipeline.
* **Type safety:** generate `src/i18n/keys.d.ts` from the English bundles so `t()` autocompletes and typos break the build. `i18next` has a typed-keys helper for this.
* **Pseudo-locale (`en-XA`):** ship an automatically generated pseudo-translation (wraps each string in brackets, lengthens by 30%) that QA can switch to to spot un-extracted strings and layout overflow.

### **Phase 9: Rollout**

* **v1 launch languages:** `en` + one other (Spanish or the user's preferred second target) — picking a single second language exercises every layer end-to-end without ballooning translation cost.
* **Feature flag** on the language switcher: visible to admins first, then everyone.
* **Telemetry:** log selected locale on the issues/feedback events already wired up so usage informs which third language to add.
* **Docs:** add a "Translating Trackbit" section to `readme.md` covering namespace structure, key conventions, and how to run the CI lint locally.

---

## **Open Questions**

1. **Admin app scope.** Translate `apps/admin` now, or keep it English-only? It is internal staff tooling and the cost of translating it is non-trivial.
2. **Unit system.** Treat `kg`/`lbs` as a locale concern (auto-pick from country) or an independent user preference? Most fitness apps make it a separate setting.
3. **URL locale prefix.** Three viable shapes for how the active language relates to the URL:

   * **Path prefix — `/en/tracker`, `/es/tracker`.** The classic "industry-standard" choice (Next.js i18n, marketing sites). Strengths: shareable URLs preserve language across users, search engines can index per-language variants, deep links from emails always render in the intended language regardless of who clicks. Costs: every route definition has to live under a `:lang` parameter in React Router 7, which means either wrapping the entire route tree in a layout route that parses and validates the segment, or duplicating the tree per language. Mismatched paths (link says `/es/tracker`, user prefers `en`) need a resolution rule — usually "URL wins, update preference" — and that opens a second class of bugs where a stale tab silently changes the user's saved language. There is also a redirect cost on every unprefixed entry (`/tracker` → `/en/tracker`) which adds a flash on cold loads.

   * **Query param — `/tracker?lang=es`.** Cheaper to retrofit (no route restructure) and still survives copy-paste. But it's ugly, easy to strip when users edit URLs, and gives no SEO benefit. It also fights with existing query params (the tracker already uses `useSearchParams`) so there's a small risk of collision with feature params. Mostly a worst-of-both-worlds option — recommend against.

   * **No URL representation; persist on the user record + `localStorage`.** Language is purely a preference, resolved on app boot via the order in Phase 3 (session → localStorage → `navigator.language` → `en`). URLs stay clean and stable. The only thing it can't do is make a shared link render in the sender's language for a different recipient.

   **Recommendation: no URL representation.** The reasoning is specific to what Trackbit actually is:

   * It's a logged-in habit tracker. There is no public/marketing surface served by `apps/frontend` — every meaningful route sits behind auth — so there's nothing for search engines to index per-language. The SEO argument for path prefixes evaporates.
   * Habit data isn't shared between users. The "shared link" scenario that path prefixes solve (I send you `/es/article/123`, you read it in Spanish) basically doesn't exist here. Marketing emails sent by Trackbit itself can be rendered server-side in the recipient's locale (Phase 7) without needing the URL to carry it.
   * React Router 7 SPA setup means every prefix variant pays a wrapper-route + redirect cost on every navigation, for a benefit that doesn't apply.
   * Backend already resolves a per-request locale from session + `Accept-Language` (Phase 7), so emails and API errors are correctly localized without any URL involvement.

   If a public marketing site or blog is later added — likely a separate Next.js app, not this SPA — *that* surface should use path prefixes, but it's a different codebase and a different decision. For `apps/frontend` and `apps/admin`, persist the preference and leave the URL alone.

   **One concession worth making:** support a `?lang=` *override* (read once on mount, written into `localStorage`, then stripped from the URL) so support staff can send a one-shot link like `/account?lang=es` to reproduce a user's bug report. Cheap to implement, doesn't pollute the routing layer, and covers the only realistic "URL needs to carry language" scenario this app has.
4. **RTL support.** Any planned target languages that need RTL (Arabic, Hebrew)? If yes, the Tailwind config needs `dir`-aware utilities now rather than as a retrofit.
