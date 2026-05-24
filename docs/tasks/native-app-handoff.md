# Native App — Phase 1 Auth Handoff

## Branch
`android`

## What was done this session

### 1. Secure token storage (`src/lib/token-store.ts`)
- Installed `expo-secure-store@~56.0.4` via npm directly (pnpm workspace blocked by missing `@trackbit/hacienda-client` in backend — pre-existing issue)
- Created `src/lib/token-store.ts` with three exports: `saveToken`, `loadToken`, `clearToken`
- Uses `AFTER_FIRST_UNLOCK` accessibility level so token is readable on app resume

### 2. Auth context (`src/context/auth-context.tsx`)
- `AuthProvider` hydrates from SecureStore on mount → calls `GET /api/auth/get-session` to validate token
- Exposes `useAuth()` hook: `{ user, isLoading, signIn, signOut }`
- `signIn` calls backend, persists token, sets user
- `signOut` calls backend (best-effort), clears token, nulls user
- Stale token on boot is automatically cleared

### 3. Route guard (`src/app/_layout.tsx`)
- Restructured routes: `index.tsx` + `explore.tsx` moved into `src/app/(tabs)/` group so auth and tab stacks can coexist
- New `src/app/(tabs)/_layout.tsx` renders `AppTabs` (NativeTabs — trigger names unchanged)
- Root `_layout.tsx` uses `Stack.Protected` from expo-router:
  - `guard={!isLoading && !!user}` → shows `(tabs)`
  - `guard={!isLoading && !user}` → shows `auth`
  - Both false while loading → `AnimatedSplashOverlay` covers the blank
- `src/app/auth/_layout.tsx` — minimal Stack stub
- `src/app/auth/sign-in.tsx` — placeholder screen (just "Sign in" text)

## Current file tree (src/app/)
```
src/app/
├── _layout.tsx           ← AuthProvider + Stack.Protected guard
├── (tabs)/
│   ├── _layout.tsx       ← AppTabs (NativeTabs)
│   ├── index.tsx         ← Home tab (placeholder content)
│   └── explore.tsx       ← Explore tab (placeholder content)
└── auth/
    ├── _layout.tsx       ← headerless Stack (stub)
    └── sign-in.tsx       ← placeholder, NEEDS REAL IMPLEMENTATION
```

## Uncommitted changes
Everything above is uncommitted. Suggested commit message:

```
feat(native): auth session management with secure token storage and route guard

- Install expo-secure-store; add token-store.ts (saveToken/loadToken/clearToken)
  with AFTER_FIRST_UNLOCK accessibility so tokens survive app resume
- Add AuthProvider/useAuth context: hydrates from SecureStore on boot,
  exposes signIn, signOut, isLoading, user
- Restructure routes into (tabs)/ group so auth and tab stacks can coexist
  at the root level
- Replace root _layout.tsx with Stack.Protected guard: unauthenticated users
  land on auth/sign-in, authenticated users land on (tabs); both guards are
  false while isLoading so the splash overlay covers the hydration window
- Add auth/_layout.tsx stack and sign-in.tsx placeholder (full form next)
```

## Next tasks (Phase 1, in order)

- [ ] `src/app/auth/sign-in.tsx` — real sign-in screen (email + password form)
- [ ] `src/app/auth/sign-up.tsx` — sign-up screen (name, email, password)
- [ ] `src/app/auth/_layout.tsx` — may need expanding (currently a bare Stack stub)
- [ ] Form validation with Zod (match web validation rules)
- [ ] Loading and error states on auth forms
- [ ] "Remember me" — persist session vs. session-only

## Key files to read before continuing

| File | Why |
|------|-----|
| `src/lib/auth.ts` | All backend auth calls — `signIn`, `signUp`, `signOut`, `getSession` |
| `src/lib/api.ts` | `apiFetch` helper — accepts `token`, `body`, `onResponse` |
| `src/lib/token-store.ts` | `saveToken` / `loadToken` / `clearToken` |
| `src/context/auth-context.tsx` | `useAuth()` — wire into sign-in form |
| `apps/native/AGENTS.md` | **Read Expo v56 docs before writing any code** |

## Notes / gotchas

- `expo install` is broken at workspace level due to missing `@trackbit/hacienda-client` package in backend. Use `npm install --legacy-peer-deps` directly inside `apps/native/` for new packages.
- Always fetch docs at `https://docs.expo.dev/versions/v56.0.0/` before using an Expo SDK (per AGENTS.md).
- The `AnimatedSplashOverlay` auto-dismisses after 600ms regardless of auth state. If session hydration takes >600ms on a slow network, there is a brief blank screen — acceptable for now, deferred to polish phase.
- Backend auth transport: **bearer token** via `Authorization: Bearer <token>` header. Token comes from `set-auth-token` response header on sign-in (signed token required by `requireSignature: true`). See `auth.ts:extractToken`.
