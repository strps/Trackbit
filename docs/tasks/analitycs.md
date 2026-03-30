# Analytics Features

## DONE Feature 1 — Exercise Performance Chart

A line/area chart per exercise showing progression over time. The user picks an exercise from a selector, picks a metric (max weight, total volume, estimated 1RM, avg RPE), and picks a time range (`1M` / `3M` / `6M` / `1Y` / `All`). Each data point is one session. PRs get a marker annotation. This is the centerpiece feature.

- **Data source:** Iterate `dayLogs` → `exerciseSessions` → `exerciseLogs` → `exercisePerformances`, filter by `exerciseId`, aggregate per date.
- **New component:** `ExerciseChart.tsx`
- **New hook logic:** `use-analytics.ts`: `getExerciseTimeSeries(exerciseId, metric, range)`

---

## DONE Feature 2 — Volume Load Overview

A bar chart showing total weekly volume (sets × reps × weight) across all exercises or filtered by habit. Gives a training load picture at a glance. Pairs naturally with an RPE overlay line so you can see effort vs output trends.

- **Data source:** Same traversal as above but aggregated by ISO week.
- **New component:** `VolumeChart.tsx`
- **New hook logic:** `getWeeklyVolume(habitId, range)`

---

## DONE Feature 3 — Muscle Group Balance

A grid or simple bar chart showing how much volume landed on each muscle group in the selected period. Since `Exercise` already has `muscleGroups`, this is mostly a join. Useful for spotting neglected groups or imbalances (e.g. lots of chest, no back).

- **New component:** `MuscleGroupBreakdown.tsx`
- **New hook logic:** `getMuscleGroupVolume(habitId, range)`

---

## Feature 4 — Expanded Stat Cards

Right now you have 3 cards: total completions, streak, goal frequency. Worth adding for complex habits: total sessions, total sets logged, heaviest lift ever (PR), longest streak (not just current). These are cheap to compute from existing data and make the top of the page much more informative.

- **Changes:** Expand `AnalyticsStats` interface and stats memo in `use-analytics.ts`, update `Stats.tsx` to render conditionally based on habit type.

---

## Feature 5 — Time Range Filter (Global)

A shared `1M` / `3M` / `6M` / `1Y` / `All` toggle that gates all charts and stats on the page. Stored in local UI state (or `useUIStore` if you want it to persist). All hooks accept a `range` param that filters `dayLogs` before computing.

- **New:** `TimeRangeSelector.tsx` (small segmented control)
- **Change:** Add `range` param to all analytics computations.

---

## Suggested Build Order

1. **Time range filter first** — it's a dependency for everything else and tiny to build
2. **Expanded stat cards** — quick win, no new charts needed
3. **Exercise performance chart** — highest user value
4. **Volume load chart** — builds on the same data traversal
5. **Muscle group breakdown** — last because it depends on the muscleGroups join being reliable
