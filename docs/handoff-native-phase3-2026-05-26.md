# Context Dump — Trackbit Native App (Phase 3)

## Project
Trackbit is a monorepo (pnpm workspaces) at `/home/cj/dev/Trackbit`.
- Backend: `apps/backend` (Hono + Drizzle + Postgres)
- Frontend: `apps/frontend` (Vite/React)
- Native: `apps/native` (Expo ~56, Expo Router, React 19, RN 0.85, TypeScript strict)

Working branch: `android`. Main branch: `main`. Git user: `strps`.

## What we just built (this session)

### `rpe-selector.tsx` + RPE editing in `SetRow`

| File | Status |
|---|---|
| `apps/native/src/components/rpe-selector.tsx` | NEW — RPE picker bottom sheet |
| `apps/native/src/components/set-row.tsx` | UPDATED — RPE badge + edit-mode RPE button wired to sheet |

**`RpeSelector` props:**
```ts
interface RpeSelectorProps {
  visible: boolean;
  value: number | null;
  onChange: (value: number | null) => void;
  onClose: () => void;
}
```

**Sheet layout (340px tall):**
```
┌─────────────────────────────────────────┐
│              ─────                       │  drag handle
│      Rate of Perceived Exertion          │
│                                          │
│   [1] [2] [3] [4] [5]                    │  2×5 grid, 56×56
│   [6] [7] [8] [9] [10]                   │
│                                          │
│              Very Hard                   │  italic label
└─────────────────────────────────────────┘
```

- 2×5 grid, 56×56 buttons, gap = `Spacing.two`, `flexWrap: wrap`, centered.
- **Zone colors** mirror web (`packages/ui/src/components/RpeSelector.tsx`):
  - 1–3 → `#10B981` (emerald), 4–6 → `#FBBF24` (amber), 7–8 → `#F97316` (orange), 9–10 → `#EF4444` (red).
- Selected: button filled with zone color, white text, matching border.
- Unselected: `theme.backgroundSelected` bg, `theme.text` fg, transparent 2px border (preserves layout).
- Animation: same Modal + Reanimated `withSpring` / `withTiming` pattern as `exercise-picker.tsx`.
- Backdrop tap → `handleClose` (no change).
- Tapping selected level → `onChange(null)` + close (clears RPE).
- `RPE_LABELS` constant exported from the file; mirrors web labels.

### `SetRow` wiring (`apps/native/src/components/set-row.tsx`)

1. Added `const [rpeOpen, setRpeOpen] = useState(false)`.
2. **Display mode**: RPE badge (when set) wrapped in `TouchableOpacity` → `setRpeOpen(true)` (gated by `!pending`).
3. **Edit mode**: new `rpeEditBtn` rendered between numeric inputs and ✓ save button — shows `"RPE n"` when set or `"RPE"` placeholder when null. Tapping it opens the sheet without leaving edit mode.
4. Component returns `<>{Swipeable...}{rpeSheet}</>` so the modal lives outside the gesture-handler tree.
5. `onChange` calls `updatePerf.mutate({ id: performance.id, rpe })` — `useUpdatePerformance` already accepts `rpe` via `UpdatePerformanceInput` and optimistically patches the cache.

No new dependencies. No hook changes.

## Previous session — Exercise picker + set-row foundation

| File | Status |
|---|---|
| `apps/native/src/components/exercise-picker.tsx` | NEW — bottom sheet picker (Search/Favorites/Program tabs) |
| `apps/native/src/components/set-row.tsx` | NEW — per-set row with inline edit + swipe-to-delete |
| `apps/native/src/app/session/[id].tsx` | Expanded exercise log cards + "+ Add exercise"/"+ Add set" |

`ExerciseLogRow` card structure:
```
┌─────────────────────────────────────────┐
│ [Dumbbell 36×36]  name                  │  ← header
│                   category              │
├─────────────────────────────────────────┤
│  1   10 × 100 kg              RPE 8     │  ← SetRow (tap badge → RPE sheet)
│  2   8  × 100 kg                        │
├─────────────────────────────────────────┤
│  + Add set                              │  ← copies prev set's reps/weight
└─────────────────────────────────────────┘
```

## Phase 3 remaining tasks (from `docs/tasks/native-app.md`)

- [ ] Custom exercise creation flow
- [ ] Favorites tab — backend schema + endpoint + hook needed before wiring
- [ ] Program tab — concept undefined; defer until design decision

## Next logical step

**Custom exercise creation flow.** From the `ExercisePicker` Search tab, allow the user to create a new `ExerciseInfo` when their query returns no match. Likely UX: an empty-state "+ Create '<query>'" row at the bottom of the list that opens a small form (name, category, default unit) and POSTs to `/api/exercise-info`, then adds the new exercise to the session in one go. Verify the backend endpoint exists before scoping.

## Environment quirks
- lucide-react-native is **v1.16.0**. No `BarChart2` — use `ChartBar`. Confirmed available: `Settings`, `TrendingUp`, `House`, `Dumbbell`, `Search`, `Star`, `Play`, `Plus`, `Check`, `Trash2`.
- Expo Router uses **typed routes** — new route files must exist before TypeScript resolves `router.push('/new-path/...')`. Pattern in codebase: `href={'/path' as Href}` as escape hatch.
- No `__drizzle_migrations` table — migrations were applied directly.
- `lucide-react-native` type for icons: `import { type LucideIcon } from 'lucide-react-native'`
- `AGENTS.md` at `apps/native/` says: read Expo v56 docs at `https://docs.expo.dev/versions/v56.0.0/` before writing native code.
- Auth uses **Bearer token** stored in `expo-secure-store`, attached via `Authorization` header in `apiFetch`. No cookies.
- API base URL from `EXPO_PUBLIC_API_URL` env var (defaults to `http://localhost:3000`).
- No bottom sheet package installed. Reanimated 4.3.1 + Gesture Handler ~2.31.1 are available — used directly for both `exercise-picker.tsx` and `rpe-selector.tsx`.

## Key file paths to know
- API layer: `src/lib/api.ts` (`apiFetch`), `src/lib/habits-api.ts`, `src/lib/tracker-api.ts`
- Auth: `src/context/auth-context.tsx` → `useAuth()` exposes `{ token, user, signIn, signOut }`
- Theme: `src/constants/theme.ts` → `Colors`, `Spacing`, `Fonts`; `src/hooks/use-theme.ts` → `useTheme()` returns `Colors.light | Colors.dark`
- Components: `src/components/habit-row.tsx` has `HabitIcon`, `accentColor`, `COLOR_THEME_ACCENT`
- Exercise picker: `src/components/exercise-picker.tsx` — bottom sheet pattern (Modal + Reanimated)
- RPE selector: `src/components/rpe-selector.tsx` — `RpeSelector` + exported `RPE_LABELS`
- Set row: `src/components/set-row.tsx` — `SetRow` component
- Session screen: `src/app/session/[id].tsx`

## Mutation hooks (all in `src/hooks/use-tracker.ts`)
| Hook | Signature | Notes |
|---|---|---|
| `useCreatePerformance` | `mutate(CreatePerformanceInput)` | Optimistic: temp id = `-Date.now()` |
| `useUpdatePerformance` | `mutate({ id, ...UpdatePerformanceInput })` | Optimistic patch via `Object.assign`; accepts `rpe` |
| `useDeletePerformance` | `mutate(performanceId: number)` | Optimistic remove |
| `useAddExerciseLog` | `mutate({ exerciseSessionId, exerciseId })` | Non-optimistic, invalidates history |
| `useRemoveExerciseLog` | `mutate(logId: number)` | Optimistic remove |
