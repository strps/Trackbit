# Context Dump — Trackbit Native App (Phase 3)

## Project
Trackbit is a monorepo (pnpm workspaces) at `/home/cj/dev/Trackbit`.
- Backend: `apps/backend` (Hono + Drizzle + Postgres)
- Frontend: `apps/frontend` (Vite/React)
- Native: `apps/native` (Expo ~56, Expo Router, React 19, RN 0.85, TypeScript strict)

Working branch: `android`. Main branch: `main`. Git user: `strps`.

## What we just built (this session)

### Exercise picker bottom sheet (`src/components/exercise-picker.tsx`) — NEW

| File | Status |
|---|---|
| `apps/native/src/components/exercise-picker.tsx` | NEW — bottom sheet picker |
| `apps/native/src/app/session/[id].tsx` | UPDATED — "Add exercise" button + picker wired |

**Props:**
```ts
interface ExercisePickerProps {
  visible: boolean;
  exerciseSessionId: number;
  onClose: () => void;
}
```

**Animation:** RN `Modal` (transparent, no system animation) + Reanimated `useSharedValue` slide-up via `withSpring` on open, `withTiming` on close. `runOnJS(onClose)()` fires after animation completes. No new packages needed.

**Three tabs:**
- **Search** (functional) — live-filtered `SectionList`; "Recommended" section (exercises with `lastPerformance !== null`, max 3) shown when query is empty; "All exercises" section for the remainder
- **Favorites** (mocked) — Star icon + "Favorites coming soon."
- **Program** (mocked) — Dumbbell icon + "Program coming soon."

**Exercise row layout:**
```
[Dumbbell icon 36×36]  [name + category]  [Play button 36×36 circle]
```
Tapping the row or play button calls `useAddExerciseLog({ exerciseSessionId, exerciseId })` then closes the sheet.

**Session screen changes:**
- `pickerVisible` state + `useSafeAreaInsets`
- Floating pill button ("+ Add exercise") at `bottom: insets.bottom + Spacing.three`, absolute-positioned
- FlatList `paddingBottom: insets.bottom + 72` so list content clears the button
- `<ExercisePicker>` rendered at root level (outside FlatList), gated on `session` being defined

## Phase 3 remaining tasks (from `docs/tasks/native-app.md`)

- [ ] `src/components/set-row.tsx` — a single logged set (exercise, reps, weight, RPE)
- [ ] `src/components/rpe-selector.tsx` — RPE picker (native bottom sheet)
- [ ] Add set form — inline form on set-row (reps + weight inputs, RPE picker)
- [ ] Swipe-to-delete on set rows
- [ ] Custom exercise creation flow
- [ ] Favorites tab — backend schema + endpoint + hook needed before wiring
- [ ] Program tab — concept undefined; defer until design decision

## Next logical step
Build **`set-row.tsx`** — the component that renders a single `ExercisePerformance` (one logged set) inside the session screen. It sits inside the `ExerciseLogRow` grouping and will need:
- Display: reps, weight (with unit), RPE badge
- Edit: inline inputs for reps + weight, `rpe-selector.tsx` for RPE
- Swipe-to-delete via gesture handler

## Environment quirks
- lucide-react-native is **v1.16.0**. No `BarChart2` — use `ChartBar`. `Settings`, `TrendingUp`, `House`, `Dumbbell`, `Search`, `Star`, `Play`, `Plus` all confirmed available.
- Expo Router uses **typed routes** — new route files must exist before TypeScript resolves `router.push('/new-path/...')`. Pattern in codebase: `href={'/path' as Href}` as escape hatch.
- No `__drizzle_migrations` table — migrations were applied directly.
- `lucide-react-native` type for icons: `import { type LucideIcon } from 'lucide-react-native'`
- `AGENTS.md` at `apps/native/` says: read Expo v56 docs at `https://docs.expo.dev/versions/v56.0.0/` before writing native code.
- Auth uses **Bearer token** stored in `expo-secure-store`, attached via `Authorization` header in `apiFetch`. No cookies.
- API base URL from `EXPO_PUBLIC_API_URL` env var (defaults to `http://localhost:3000`).
- No bottom sheet package installed. Reanimated 4.3.1 + Gesture Handler ~2.31.1 are available.

## Key file paths to know
- API layer: `src/lib/api.ts` (`apiFetch`), `src/lib/habits-api.ts`, `src/lib/tracker-api.ts`
- Auth: `src/context/auth-context.tsx` → `useAuth()` exposes `{ token, user, signIn, signOut }`
- Theme: `src/constants/theme.ts` → `Colors`, `Spacing`, `Fonts`; `src/hooks/use-theme.ts` → `useTheme()` returns `Colors.light | Colors.dark`
- Components: `src/components/habit-row.tsx` has `HabitIcon`, `accentColor`, `COLOR_THEME_ACCENT`
- Picker: `src/components/exercise-picker.tsx` — `ExercisePicker` component
- Session screen: `src/app/session/[id].tsx`
