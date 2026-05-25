# Handoff: Native App — Phase 2 Complete

**Date:** 2026-05-25  
**Branch:** `android`  
**Repo:** `/home/cj/dev/Trackbit`  
**Working directory:** `apps/native/`

---

## Status

Phase 2 (Habit List) is **fully complete**. All data-layer and UI tasks are done. The home tab is a live habits list with optimistic logging.

The full task plan is at `docs/tasks/native-app.md`. Phase 3 (Activity Logging) is next.

---

## What was done — Session 1 (data layer)

### `apps/native/src/lib/habits-api.ts` — NEW
Typed API wrappers over `apiFetch`:

| Function | Endpoint |
|---|---|
| `getHabits(token)` | `GET /api/habits` |
| `logHabit(params, token, tz?)` | `POST /api/tracker/check?tz=…` |
| `deleteHabitLog(id, token)` | `DELETE /api/tracker/day-logs/:id` |

Exported types: `Habit`, `HabitType`, `ColorTheme`, `ColorStop`, `LogHabitParams`, `LogHabitResult`.  
`Habit` includes `frozen: boolean` (from backend) and `loggedToday?: boolean` (client-only, set by optimistic update).

### `apps/native/src/hooks/use-habits.ts` — NEW
React Query `useQuery`. Gated with `enabled: token !== null`. Exports `habitsQueryKey` and `loggedTodayKey`. Uses a `select` transform to merge the `loggedTodayKey` cache set into each habit's `loggedToday` field, so check marks survive a server refetch.

### `apps/native/src/hooks/use-log-habit.ts` — NEW
React Query `useMutation`. Full optimistic update:
- `onMutate`: cancels in-flight habits queries, snapshots the cache, adds `habitId` to `loggedTodayKey` set, sets `loggedToday: true` on the habit directly
- `onError`: rolls back habits cache and removes from `loggedTodayKey` set
- `onSuccess`: invalidates habits query (server refetch; `select` re-applies `loggedTodayKey` so check marks persist)
- `mutationFn`: passes device timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone` as `?tz=` query param

### `apps/native/src/app/_layout.tsx` — MODIFIED
Added `QueryClientProvider` wrapping full tree. `queryClient` at module level. Provider order: `QueryClientProvider > AuthProvider > ThemeProvider`.

### `@tanstack/react-query` installed
Version `^5.100.14`.

---

## What was done — Session 2 (UI + dark mode)

### `apps/native/src/components/habit-row.tsx` — NEW
Single habit row:
- Colored circle accent (mapped from `colorTheme`; for `custom` themes, picks the midpoint `colorStop`)
- Icon shown as emoji (mapped from icon name: `dumbbell`, `code`, `book`, `star`, `water`, `alert`)
- Habit name, truncated to 1 line
- Right status: filled check circle (logged), empty circle (unlogged), 🔒 (frozen)
- Disabled + greyed out when `frozen: true` or when this habit's mutation is in-flight

### `apps/native/src/components/habit-list.tsx` — NEW
`FlatList` with manually interleaved section headers:
- "Active" section (non-frozen habits)
- "Frozen" section (if any exist)
- Pull-to-refresh via `RefreshControl`
- Empty state (🌱) when no habits

### `apps/native/src/app/(tabs)/index.tsx` — REPLACED
Full home screen:
- "Today, May 25" date header
- `useHabits()` for list data; `useLogHabit()` for tap-to-log
- Loading skeleton while `isLoading`
- Passes `loggingId` (the in-flight `habitId`) to `HabitList` so the row disables during the mutation

### `apps/native/src/app/_layout.tsx` — MODIFIED (dark mode fix)
Added `Appearance.setColorScheme('dark')` at module level. `userInterfaceStyle: "dark"` in `app.json` only applies to standalone native builds; this call forces `useColorScheme()` to return `'dark'` in Expo Go and web as well.

---

## Key files

| Path | Purpose |
|---|---|
| `src/lib/api.ts` | Base `apiFetch` helper; attaches Bearer token |
| `src/lib/auth.ts` | Auth calls + `AuthUser` type |
| `src/lib/habits-api.ts` | Habits + tracker API wrappers |
| `src/context/auth-context.tsx` | `useAuth()` — `token`, `user`, `signIn`, `signOut` |
| `src/hooks/use-habits.ts` | React Query habits list; exports `habitsQueryKey`, `loggedTodayKey` |
| `src/hooks/use-log-habit.ts` | React Query log mutation with optimistic updates |
| `src/components/habit-row.tsx` | Single habit row component |
| `src/components/habit-list.tsx` | FlatList with sections, pull-to-refresh, empty state |
| `src/app/(tabs)/index.tsx` | Home screen — date header + habit list |
| `src/app/_layout.tsx` | Root layout — auth guard, providers, dark mode |
| `src/constants/theme.ts` | Design tokens: `Colors`, `Spacing`, `Fonts` |
| `docs/tasks/native-app.md` | Full phased task plan |

---

## Important backend notes

- **Auth transport:** Bearer token via `Authorization: Bearer <token>`. Token is in the `set-auth-token` response header on sign-in.
- **`frozen` field:** `GET /api/habits` returns each habit with `frozen: boolean` added by the backend. Frozen habits exceed the user's role limit — show as read-only/locked, not hidden.
- **`POST /api/tracker/check`:** Upserts a day log. `timeStamp` must be ISO 8601. `rating` for a binary check is `1`. Pass `?tz=<IANA timezone>` (e.g. `America/New_York`). Defaults to `America/Costa_Rica` if omitted.
- **`loggedToday` is client-only:** The backend does not return this field. It is synthesised on the client from the `loggedTodayKey` React Query cache entry (a `Set<number>` of logged habit IDs for the session).

---

## Architectural conventions

- Path alias `@/` → `src/`
- Theming: `useTheme()` from `@/hooks/use-theme` returns the current `Colors.*` object; never hardcode colors
- `ThemedText` / `ThemedView` for automatic dark/light theming
- Expo Router file-based routing; tab screens live in `src/app/(tabs)/`
- Strict TypeScript; no `any` in new code
- Tab bar is at the TOP (see `app-tabs.tsx`) and owns the top safe area — screens do NOT need `<SafeAreaView edges={['top']}>`
- Read versioned Expo docs at https://docs.expo.dev/versions/v56.0.0/ before using any Expo API

---

## What's next — Phase 3 (Activity Logging)

See `docs/tasks/native-app.md` Phase 3 for the full task list. Summary:

1. **`src/lib/tracker-api.ts`** — typed wrappers for tracker/exercise endpoints
2. **`src/hooks/use-tracker.ts`** — React Query hooks for sessions and history
3. **`src/app/(tabs)/log.tsx`** — log screen (currently a placeholder)
4. **Exercise picker** — searchable list from `GET /api/exercise-info`
5. **`src/components/set-row.tsx`** — a logged set (exercise, reps, weight, RPE)
6. **`src/components/rpe-selector.tsx`** — RPE picker via native bottom sheet
7. **Set form** — modal or inline form to add a set
8. **Session summary** at top (total sets, duration)
9. **Swipe-to-delete** on set rows

Likely new dependency: `@gorhom/bottom-sheet` (or Expo native sheet if stable in v56 — check docs first).
