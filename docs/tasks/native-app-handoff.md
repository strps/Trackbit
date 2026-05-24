# Native App — Phase 1 Auth Handoff

## Branch
`android`

## What was done (sessions 1–3)

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
- `src/app/auth/_layout.tsx` — minimal Stack stub (headerShown: false)
- `src/app/auth/sign-in.tsx` — **real implementation complete** (see below)

### 4. Sign-in screen (`src/app/auth/sign-in.tsx`) ✅
- Installed `zod@^4.4.3` via `npm install --legacy-peer-deps` inside `apps/native/`
- Email + password form using React Native `TextInput`
- `KeyboardAvoidingView` + `ScrollView` so keyboard doesn't obscure fields
- Zod schema validates on submit; per-field errors clear inline as user types
- Server error displayed in a red banner above the form
- Show/Hide password toggle (text button, cross-platform, no icon library needed)
- Loading state: button dims + shows "Signing in…", inputs non-editable during request
- Calls `useAuth().signIn`; `Stack.Protected` handles redirect to `(tabs)` on success
- Sign-up link at bottom navigates to `/auth/sign-up`

### 5. Sign-up screen (`src/app/auth/sign-up.tsx`) ✅
- Name + email + password form; same patterns as sign-in
- `useRef` focus chain: name → email → password → submit on return key
- `textContentType="newPassword"` / `autoComplete="new-password"` so iOS/Android offer to save credentials
- Submit flow: `Auth.signUp()` first (returns `{ user }`, no token), then `useAuth().signIn()` to get the token and set the session
- `Stack.Protected` handles redirect to `(tabs)` on success
- "Sign in" footer link calls `router.back()` to avoid stacking a duplicate sign-in route

## Current file tree (src/app/)
```
src/app/
├── _layout.tsx           ← AuthProvider + Stack.Protected guard
├── (tabs)/
│   ├── _layout.tsx       ← AppTabs (NativeTabs)
│   ├── index.tsx         ← Home tab (placeholder content)
│   └── explore.tsx       ← Explore tab (placeholder content)
└── auth/
    ├── _layout.tsx       ← headerless Stack
    ├── sign-in.tsx       ← ✅ DONE — real form with Zod validation
    └── sign-up.tsx       ← ✅ DONE — real form with Zod validation
```

## Committed changes
- `feat(native): auth session management with secure token storage and route guard`
- `feat(native): sign-in screen with Zod validation and loading/error states`
- `feat(native): sign-up screen with Zod validation and auto sign-in on success`

## Next tasks (Phase 1, in order)

- [x] `src/app/auth/sign-in.tsx` — real sign-in screen (email + password form)
- [x] `src/app/auth/sign-up.tsx` — sign-up screen (name, email, password)
- [x] Form validation with Zod on both auth forms (8-char password min matches backend)
- [x] Loading and error states on both auth forms
- [ ] `src/app/auth/_layout.tsx` — may need expanding if sign-up needs different header behaviour
- [ ] "Remember me" — persist session vs. session-only

## Key files to read before continuing

| File | Why |
|------|-----|
| `src/lib/auth.ts` | All backend auth calls — `signIn`, `signUp`, `signOut`, `getSession` |
| `src/lib/api.ts` | `apiFetch` helper — accepts `token`, `body`, `onResponse` |
| `src/lib/token-store.ts` | `saveToken` / `loadToken` / `clearToken` |
| `src/context/auth-context.tsx` | `useAuth()` — `signIn`/`signOut`; no `signUp` (call `Auth.signUp` directly then `signIn`) |
| `src/app/auth/sign-in.tsx` | Reference for auth form patterns |
| `src/app/auth/sign-up.tsx` | Completed sign-up implementation |
| `apps/native/AGENTS.md` | **Read Expo v56 docs before writing any code** |

## Notes / gotchas

- `expo install` is broken at workspace level due to missing `@trackbit/hacienda-client` package in backend. Use `npm install --legacy-peer-deps` directly inside `apps/native/` for new packages.
- Always fetch docs at `https://docs.expo.dev/versions/v56.0.0/` before using an Expo SDK (per AGENTS.md).
- The `AnimatedSplashOverlay` auto-dismisses after 600ms regardless of auth state. If session hydration takes >600ms on a slow network, there is a brief blank screen — acceptable for now, deferred to polish phase.
- Backend auth transport: **bearer token** via `Authorization: Bearer <token>` header. Token comes from `set-auth-token` response header on sign-in (signed token required by `requireSignature: true`). See `auth.ts:extractToken`.
- `zod@^4.4.3` is now installed (not v3). API is mostly the same but use `z.string().email()` not `z.email()` for consistency with the existing sign-in schema.
