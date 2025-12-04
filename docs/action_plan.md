# 🚀 Momentum Beta Release Schedule

**Start Date:** Monday, December 1, 2025
**Launch Date:** Monday, December 15, 2025
**Workload:** Full-time

---

## 🏗️ Phase 1: Foundation & Refactor (Dec 1 - Dec 3)

**Focus:** Clean architecture. No new features until the base is solid.

### Monday, Dec 1

- [ ] **Type Safety Overhaul**
  - Create `src/types/models.ts`.
  - **Action:** Replace `any` in `HabitsTracker.tsx`, `DetailsPanel.tsx`, and `Stats.tsx`.

- [ ] **Color Logic Consolidation**
  - Update `src/db/schema.ts` (add `dailyGoal`, `colorPalette`).
  - Refactor `Heatmap.tsx` to use `colorUtils.ts`.

### Tuesday, Dec 2

- [ ] **Component Extraction**
  - Extract `SessionForm` and `ExerciseSessionPanel` to their own files.
  - Clean up `HabitsTracker.tsx`.

- [ ] **Style Cleanup**
  - Remove the `<style>` tag hack in `SetInputField`.

### Wednesday, Dec 3

- [ ] **Backend Hardening**
  - Audit all API routes for `zod` validation.
  - Test `requireAuth` middleware on all endpoints.

---

## ⚙️ Phase 2: Core Feature Completion (Dec 4 - Dec 7)

**Focus:** The "Loop" (Log -> Update -> Delete).

### Thursday, Dec 4

- [ ] **Complex Logging Logic**
  - Implement `PUT` (Update) logic for workout sessions.
  - Ensure the form pre-fills correctly when editing.

- [ ] **Delete Actions**
  - Implement `DELETE` endpoints.
  - Wire up `Trash` icons.

### Friday, Dec 5

- [ ] **Exercise Library Integration**
  - Finalize `ExerciseLibrary.tsx`.
  - Ensure new custom exercises appear instantly in the workout dropdown.

### Saturday, Dec 6 & Sunday, Dec 7

- [ ] **Optimistic UI & Testing**
  - **Critical:** Ensure checking a box updates the heatmap instantly (no loading spinner).
  - Run through the full user flow to catch logic bugs.

---

## 🎨 Phase 3: UX Polish (Dec 8 - Dec 11)

**Focus:** "The Vibe" & Professional Feel.

### Monday, Dec 8

- [ ] **Empty States & Skeletons**
  - Design "No Habits" onboarding card.
  - Add loading skeletons for stats/heatmap.

### Tuesday, Dec 9

- [ ] **Feedback System**
  - Add Toast notifications (Success/Error).

### Wednesday, Dec 10

- [ ] **Mobile Responsiveness**
  - Audit touch targets and horizontal scrolling.
  - Ensure mobile menu works.

### Thursday, Dec 11

- [ ] **Visual QA**
  - Dark mode contrast check.
  - Icon consistency check.

---

## 🚀 Phase 4: Deployment (Dec 12 - Dec 15)

**Focus:** Production Infrastructure.

### Friday, Dec 12

- [ ] **Cloud DB & Backend**
  - Set up Neon/Railway Postgres.
  - Dockerize and deploy Fastify backend.

### Saturday, Dec 13

- [ ] **Frontend Deployment**
  - Deploy to Vercel.
  - Verify Production Environment Variables.

### Sunday, Dec 14

- [ ] **Smoke Testing**
  - Final manual test on production URL.

### Monday, Dec 15

- [ ] **🚀 LAUNCH DAY**
