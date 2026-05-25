# Handoff: Native App — Phase 2 (Habit List)

**Date:** 2026-05-25  
**Branch:** `android`  
**Repo:** `/home/cj/dev/Trackbit`  
**Working directory:** `apps/native/`

---

## Context

The Trackbit monorepo has an Expo 56 native app at `apps/native/`. Phase 0 (theming/tabs) and Phase 1 (auth/session) are fully complete. This session completed the first four tasks of Phase 2 — the data layer. The remaining Phase 2 work is all UI.

The full task plan is at `docs/tasks/native-app.md`.

---

## What was done this session

### 1. `apps/native/src/lib/habits-api.ts` — NEW

Typed API wrappers over the existing `apiFetch` helper (`src/lib/api.ts`).

Three exported functions:

| Function | Endpoint | Notes |
|---|---|---|
| `getHabits(token)` | `GET /api/habits` | Returns `Habit[]`; backend adds `frozen: boolean` to each row |
| `logHabit(params, token)` | `POST /api/tracker/check` | Body: `{ habitId, rating, timeStamp }` |
| `deleteHabitLog(id, token)` | `DELETE /api/tracker/day-logs/:id` | For undoing a log |

Exported types: `Habit`, `HabitType`, `ColorTheme`, `ColorStop`, `LogHabitParams`, `LogHabitResult` — all derived directly from the backend Drizzle schema and Zod validators in `apps/backend/src/routes/app/habits.ts` and `tracker.ts`.

### 2. `apps/native/src/hooks/use-habits.ts` — NEW

React Query `useQuery` hook. Reads `token` from `useAuth()`. Gated with `enabled: token !== null`. Exports `habitsQueryKey = ["habits"]` for mutation invalidation.

### 3. `apps/native/src/hooks/use-log-habit.ts` — NEW

React Query `useMutation` hook. Calls `logHabit`, invalidates `habitsQueryKey` on success so the list refetches.

### 4. `apps/native/src/app/_layout.tsx` — MODIFIED

Added `QueryClientProvider` wrapping the full tree. `queryClient` is instantiated at module level (stable across renders). Provider order: `QueryClientProvider > AuthProvider > ThemeProvider`.

### 5. `@tanstack/react-query` installed

Version `^5.100.14` added to `apps/native/package.json`.

---

## What's left in Phase 2

All remaining work is UI. Tasks in order:

1. **`src/components/habit-row.tsx`** — single habit row  
   - Habit name, icon, color accent  
   - Tap-to-log interaction (calls `useLogHabit`)  
   - Completion state (checked / unchecked visual)  
   - Frozen treatment: greyed out, lock icon, non-interactive

2. **`src/components/habit-list.tsx`** — `FlatList` wrapper  
   - Two sections: active habits (top), frozen habits (bottom)  
   - Section headers  
   - Pull-to-refresh (`onRefresh` → `refetch()` from `useHabits`)  
   - Empty state when no habits exist

3. **`src/app/(tabs)/index.tsx`** — home screen  
   - Date header "Today, [date]"  
   - Renders `<HabitList />`  
   - Optimistic update on log: update React Query cache before the mutation settles  
   - Wire `useHabits` and `useLogHabit` together

---

## Key files to know

| Path | Purpose |
|---|---|
| `src/lib/api.ts` | Base `apiFetch` helper; attaches Bearer token |
| `src/lib/auth.ts` | Auth calls + `AuthUser` type |
| `src/lib/habits-api.ts` | Habits + tracker API wrappers (new) |
| `src/context/auth-context.tsx` | `useAuth()` — exposes `token`, `user`, `signIn`, `signOut` |
| `src/hooks/use-habits.ts` | React Query habits list query (new) |
| `src/hooks/use-log-habit.ts` | React Query log mutation (new) |
| `src/app/_layout.tsx` | Root layout — auth guard + `QueryClientProvider` |
| `src/constants/theme.ts` | Design tokens: `Colors`, `Spacing`, `Fonts` |
| `docs/tasks/native-app.md` | Full phased task plan |

---

## Important backend notes

- **Auth transport:** Bearer token via `Authorization: Bearer <token>` header. Token is obtained from `set-auth-token` response header on sign-in (not the body).
- **`frozen` field:** `GET /api/habits` returns habits with a `frozen: boolean` added by the backend. Frozen habits belong to the user but exceed their role's habit limit — they should be shown as read-only/locked, not hidden.
- **`POST /api/tracker/check`:** Upserts a day log. If a log already exists for the same local day, it updates the `rating`; otherwise it inserts. `timeStamp` must be an ISO 8601 string (e.g. `new Date().toISOString()`). `rating` for a binary "check" habit is `1`.
- **Timezone:** The tracker check endpoint accepts a `?tz=` query param (defaults to `America/Costa_Rica`). When implementing the log call, pass the device timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone`.

---

## Architectural conventions (from Phase 0/1)

- Path alias: `@/` maps to `src/`
- Theming: use `useTheme()` from `@/hooks/use-theme` to get `Colors`, `Spacing`, `Fonts`; never hardcode colors
- Components use `ThemedText` / `ThemedView` for automatic dark/light mode
- Expo Router file-based routing; tab screens live in `src/app/(tabs)/`
- Strict TypeScript; no `any` in new code
- Read versioned Expo docs at https://docs.expo.dev/versions/v56.0.0/ before using any Expo API

---

## Suggested next steps (in order)

1. Build `habit-row.tsx` first — it's the leaf component with no dependencies on the others
2. Build `habit-list.tsx` — composes `HabitRow` with `FlatList`
3. Replace the placeholder in `(tabs)/index.tsx` with the real screen
4. Add optimistic updates to `use-log-habit.ts` (update cache via `onMutate` / rollback via `onError`)
