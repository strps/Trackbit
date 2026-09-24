# Eliminating Load Flicker in `apps/frontend`

Content flashes, shifts, or swaps during the first moments of a page load — most visibly on the sign-in page (social login buttons appearing then vanishing), the app nav, and the theme. This plan fixes those at the source.

**This is explicitly not an SSR migration.** A Next.js port was evaluated and rejected: of the five distinct flicker causes catalogued below, server rendering addresses exactly one, and four of the five are fixable without changing the rendering architecture. An SSR path is documented at the end as Tier 3, for the case where Tiers 1–2 leave something unacceptable — but it should not be the starting move.

---

## Stack Snapshot

* **App:** React 19, Vite 7, `react-router-dom` 7 (`createBrowserRouter`, SPA, no loaders in use)
* **Data:** TanStack Query v4 — all fetching is client-side, on mount
* **Preferences:** four `localStorage`-backed contexts (theme, unit system, exercise card style, locale) plus server-side session values that reconcile after load
* **Deploy:** Vercel static output with an SPA rewrite

---

## Root Causes

Five separate problems produce what reads as "flickering." They need different fixes, so they are worth keeping distinct.

### 1. Theme FOUC — every dark-mode user, every hard load

[`theme-provider.tsx`](apps/frontend/src/providers/theme-provider.tsx#L31-L47) reads `localStorage` synchronously in the `useState` initializer (correct), but applies the `.dark` class to `document.documentElement` inside a `useEffect` — which runs *after* the browser's first paint. Dark mode is class-gated (`@custom-variant dark (&:is(.dark *))`, [`index.css:6`](apps/frontend/src/index.css#L6)), so the document paints in light theme and then snaps to dark.

This is a pre-React problem. No amount of routing or data-fetching work fixes it; even under SSR the same inline-script solution is required, because the preference lives in `localStorage` which the server cannot read.

### 2. `placeholderData` asserts an answer the client does not have

[`use-auth-settings.ts`](apps/frontend/src/hooks/use-auth-settings.ts#L24-L28) declares:

```ts
placeholderData: {
    googleLoginEnabled: true,
    githubLoginEnabled: true,
    passwordLoginEnabled: true,
}
```

So [`SignIn.tsx`](apps/frontend/src/features/auth/SignIn.tsx#L88-L112) unconditionally paints both social buttons, then removes whichever the server reports as disabled. The container also switches from `grid-cols-2` to `grid-cols-1`, so the surviving button resizes and moves.

The page is not flickering because data is slow. It is flickering because it renders a guess as though it were fact. `placeholderData` is the right tool when the placeholder is *usually* correct and *cheap to be wrong about* — neither holds for feature flags that gate authentication methods.

### 3. The UI-config fallback disagrees with the server — over a hardcoded constant

[`use-config.ts`](apps/frontend/src/hooks/use-config.ts#L38-L48) supplies a `defaultConfig` while loading, and it does not match what the API returns:

| Field | Client fallback | [`config.ts` response](apps/backend/src/routes/app/config.ts#L27-L52) |
|---|---|---|
| `appName` | `"HabitTrack"` | `"MomentumTrack"` |
| `primaryNav` | 2 items (Tracker, Settings) | 5 items (Tracker, Dashboard, Habits, Library, Stats) |
| widgets key | `trackerWidgets` | `dashboardWidgets` — **the names don't even match**, so the client always reads `undefined` |

The nav therefore renders two items, then re-renders with five, on every single load. The app name changes too.

The deeper issue: `GET /api/config/ui` returns a **fully hardcoded object**. It does not read the database, and its only per-user branch is commented out. The app is paying a network round-trip, a loading state, and a guaranteed layout shift for a value that is a compile-time constant.

### 4. Preference reconciliation after the session resolves

[`useLocaleSync`](apps/frontend/src/i18n/useLocaleSync.ts) and [`useUnitSystemSync`](apps/frontend/src/i18n/useUnitSystemSync.ts) render from `localStorage`, wait for `useSession()` to return over the network, then correct to the server's value. When the two disagree, visible text and units swap after paint.

Worth scoping honestly: this **self-heals**. i18next is configured with `caches: ['localStorage']` so `changeLanguage` persists, and `setUnitSystem` writes through. In practice it only fires on a device's first authenticated load. Low severity — fix it after the others.

### 5. Auth-guard bounce

[`AppLayout.tsx`](apps/frontend/src/layouts/AppLayout.tsx#L14-L20) renders `<Header />` and the full `<Outlet />` while `isPending` is true, then calls `navigate()` **during render** once the session resolves as absent. Unauthenticated visitors get a flash of the complete app shell before being sent to `/signin`.

Calling `navigate()` in the render phase is also a React correctness bug independent of the visual symptom — it happens to work today, but it is a side effect in render.

---

## Technical Implementation Plan

### Tier 1: Source fixes — no architecture change

Highest impact per unit of effort. Expected to resolve the large majority of perceived flicker. Roughly a day of work.

#### 1.1 Blocking theme script

Add to [`index.html`](apps/frontend/index.html) in `<head>`, before the module script:

```html
<script>
  try {
    var t = localStorage.getItem('vite-ui-theme') || 'system';
    var d = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.add(d ? 'dark' : 'light');
  } catch (e) {}
</script>
```

* The storage key must stay in sync with `ThemeProvider`'s `storageKey` default (`'vite-ui-theme'`). Export it as a shared constant so the two cannot drift.
* Wrap in `try/catch` — `localStorage` throws in some privacy modes, and an uncaught error here blocks the parse of the whole document.
* The provider's `useEffect` stays as-is. It becomes a no-op on first run and continues to handle live theme changes.
* Consider adopting `next-themes` instead — it is already a dependency, `packages/ui` uses it, and it solves this correctly. Replacing the hand-rolled provider is the cleaner end state, but the inline script is the smaller, safer change. Either is acceptable; do not do both.

#### 1.2 Remove the wrong guesses

**`use-auth-settings.ts`:** delete `placeholderData`. In `SignIn.tsx` (and `SignUp.tsx`, which shares the pattern), gate the entire social block on `isSuccess` rather than on optional chaining:

```ts
const { data: authSettings, isSuccess } = useAuthSettings();
...
{isSuccess && (authSettings.googleLoginEnabled || authSettings.githubLoginEnabled) && ( ... )}
```

Reserve the block's height with a skeleton so removing the guess does not simply trade a flash for a jump. A stable empty area for ~100ms reads as loading; two buttons that appear and then vanish read as a bug.

**`use-config.ts`:** the `defaultConfig` should not exist in its current form. Two options, in order of preference:

1. **Stop fetching it.** The endpoint returns a constant. Move `appName` and `primaryNav` into a client-side module, delete the query and the loading state entirely, and re-introduce a fetch only when the response actually becomes per-user. This removes a request, a loading state, and a layout shift at once.
2. If the endpoint is about to become dynamic and option 1 would be churn: keep the query, delete `defaultConfig`, and render a nav skeleton with the correct item count until data arrives.

Either way, **fix the `trackerWidgets` / `dashboardWidgets` key mismatch** — that field is silently always `undefined` today.

#### 1.3 Fix the auth guard

In `AppLayout.tsx`, stop rendering children while the session is unresolved, and redirect declaratively:

```tsx
if (isPending) return <AppSplash />;           // or null
if (!session && !isPublic) return <Navigate to="/signin" replace />;
if (session && isPublic) return <Navigate to="/tracker" replace />;
```

`replace` matters — the current `navigate()` pushes onto history, so the back button returns to a page that immediately bounces again.

#### 1.4 Audit remaining layout shift

With the above done, walk the app on a throttled connection and note anything that still resizes after paint. Apply the same rule everywhere: **reserve the space, do not render a guess.** Known candidates are the tracker habit rows and the exercise picker.

**Exit criterion:** on a 3G-throttled hard reload in dark mode, signed out, the sign-in page paints once in its final layout.

---

### Tier 2: Route loaders — only if Tier 1 leaves gaps

React Router 7 data mode, staying on `createBrowserRouter`. Two to three days. Do this only after measuring what Tier 1 actually left behind.

* **Attach loaders that feed the existing React Query cache**, so loaders and hooks share one source of truth rather than fetching twice:

  ```ts
  {
    path: "signin",
    element: <SignInPage />,
    loader: () => queryClient.ensureQueryData({
      queryKey: ['auth-settings'],
      queryFn: fetchAuthSettings,
    }),
  }
  ```

  The component keeps calling `useAuthSettings()` unchanged — the cache is already warm, so it renders with data on first paint. `ensureQueryData` is available in Query v4; no upgrade needed.

* **Understand the limit before investing here.** In an SPA there is no server, so on a *hard reload* the loader cannot run until the JS bundle has downloaded and booted. Loaders eliminate flicker on **client-side navigations** (the route does not mount until its data resolves) and convert hard-load flicker into a *controlled* fallback via a route-level `HydrateFallback`. That is a real improvement — a deliberate skeleton instead of a wrong render — but it is not first-paint-correct HTML.

* **Collapse the request waterfall.** The bigger win available at this tier is architectural, not router-specific. A signed-in load currently fires `useSession` → `useAuthSettings` → `useUIConfig` → `useLimits` as independent requests, each with its own settling moment and its own opportunity to shift the layout. A single `GET /api/bootstrap` returning session, config, limits, and preferences in one response collapses four flicker opportunities into one. This is a backend change and can be done independently of loaders — it may well be worth more than the loaders themselves.

* **Route-level code splitting** with `React.lazy` should land here too. Nothing is lazy-loaded today; all 11 routes ship in one chunk, which delays the boot that everything else waits on.

---

### Tier 3: SSR — the escape hatch, not the plan

If Tiers 1 and 2 still leave an unacceptable first-paint gap, or if a public marketing surface makes SEO a requirement, the SSR option is **React Router framework mode** — not Next.js.

For this codebase specifically, framework mode is substantially cheaper than a Next port:

* `@react-router/dev` is **already in `devDependencies`**, unused.
* All 21 `useNavigate` and 8 `useSearchParams` call sites stay as they are. A Next port rewrites every one of them, and `useSearchParams` has different semantics there (read-only, no setter).
* **`packages/ui` needs no work.** A Next port requires `"use client"` boundaries through a `tsup`/esbuild build that may drop directives, *and* requires decoupling `Header.tsx` and `Sidebar.tsx` from `react-router-dom` — which they cannot simply drop, because `apps/admin` stays on React Router. That entire problem does not exist here.
* The migration reduces to: config swap, converting routes to route modules, and moving i18next initialization off module scope (it currently runs the browser language detector and `history.replaceState` at import time in [`i18n/index.ts`](apps/frontend/src/i18n/index.ts), which crashes on a server).

Next.js's only genuine advantage over this is the marketing/SEO story for a future public surface. That is a separate business question from flicker, and should be decided on its own merits rather than smuggled in as a performance fix.

---

## Rollout Order

```
Tier 1  (1.1 theme → 1.2 guesses → 1.3 guard → 1.4 audit)
   └─ MEASURE ← decision point; stop here if acceptable
        └─ Tier 2  (bootstrap endpoint ∥ loaders ∥ code splitting)
             └─ MEASURE ← second decision point
                  └─ Tier 3  (React Router framework mode)
```

The two measurement gates are the point of the plan. Each tier costs roughly an order of magnitude more than the one before it, and the expectation is that Tier 1 alone is sufficient.

---

## Cross-Cutting Notes

* **The governing principle is "reserve, don't guess."** Every flicker in this document is a render of assumed data that turned out wrong. A skeleton of the correct dimensions is always better than optimistic content, unless the optimistic value is genuinely near-certain.
* **Watch storage-key drift.** The theme key now appears in the inline script and the provider; unit system, card style, and locale each have their own. Centralize them in one module.
* **`AppSplash`** (from 1.3) should be visually minimal — a logo on the themed background. A spinner that appears for 80ms is itself a flicker.
* **Measure with the CLS metric**, not by eye. Chrome DevTools' Performance panel reports layout shift directly, and it will catch shifts that are easy to miss on a fast local connection.

---

## Out of Scope

* Migrating to Next.js (see Tier 3 rationale).
* Migrating `apps/admin`.
* Upgrading TanStack Query v4 → v5. Nothing in this plan requires it.
* Consolidating the duplicated Shadcn components between `src/shared/components/ui/` and `packages/ui`.

---

## Open Questions

1. Is `GET /api/config/ui` about to become genuinely per-user? The answer picks between the two options in 1.2 — deleting the fetch versus keeping it with a skeleton.
2. Replace the hand-rolled `ThemeProvider` with `next-themes` (already a dependency, already used by `packages/ui`), or keep it and add the inline script? Consolidating removes a duplicate implementation but touches more files.
3. Is a `/api/bootstrap` consolidation endpoint wanted? It is the highest-value Tier 2 item and is independent of the router work, so it could be pulled forward into Tier 1 if the backend has capacity.
4. Which flicker is actually driving this request? If it is specifically the sign-in social buttons, fix 1.2 alone and re-evaluate before committing to the rest.
