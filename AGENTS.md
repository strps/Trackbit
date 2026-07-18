# Project Guidelines

## Overview

**trackbit** is a hybrid habit tracker and workout logger. It's a pnpm monorepo with Turborepo orchestration, deployed to Vercel.

## Architecture

```
apps/frontend/     → Consumer React app (habits, tracking, analytics)
apps/backend/      → Hono REST API (PostgreSQL, Drizzle ORM, Better-Auth)
apps/admin/        → Admin dashboard (invitations, user management)
packages/ui/       → Shared Shadcn UI components (Radix + Tailwind)
packages/types/    → Shared TypeScript interfaces (Habit, Exercise, etc.)
packages/hacienda-client/ → Costa Rican e-invoicing client (WIP)
```

Internal packages use `workspace:*` references.

## Tech Stack

- **Frontend:** React 19, Vite, TanStack Query, Tailwind CSS, Shadcn UI
- **Backend:** Hono (Node.js), Drizzle ORM, PostgreSQL, Better-Auth, Zod
- **Email:** React-Email + Resend
- **Monorepo:** pnpm workspaces + Turborepo
- **Deployment:** Vercel

## Build and Test

```bash
pnpm install                         # Install all
pnpm dev                             # All apps concurrently
pnpm dev:frontend                    # Frontend only
pnpm dev:backend                     # Backend only
pnpm build                           # Build all
pnpm lint:all                        # Lint all
pnpm --filter backend db:generate    # Generate Drizzle migrations
pnpm --filter backend db:migrate     # Apply migrations
pnpm --filter backend db:studio      # Launch Drizzle Studio
```

## Conventions

### Backend

- **Framework:** Hono with typed middleware. Routes use `new Hono<AuthEnv>()`.
- **Validation:** Zod schemas via `@hono/zod-validator`. Validate at route level.
- **Responses:** `c.json(data, statusCode)`. Errors: `{ error: string }` or `{ message: string, errors: [...] }`.
- **Auth middleware:** `requireAuth` sets `user` and `session` on context. `requireAdminAuth` adds role check.
- **CORS:** `/api/auth/*` allows both frontend + admin origins. `/api/*` allows frontend only. `/admin/*` allows admin only.
- **Database:** Drizzle ORM with relations. Schema in `apps/backend/src/db/schema/`. Uses timezone-aware timestamps, JSONB fields, and enum types.
- **CRUD Factory:** `crud-router-factory.ts` auto-generates REST endpoints with ownership checks. Use for standard CRUD routes.
- **Schema Factory:** `drizzle-crud-schemas.ts` generates Zod create/update/select/id schemas from Drizzle tables.

### Frontend

- **Data fetching:** TanStack Query with optimistic updates. Page-level hooks (e.g., `use-tracker.ts`, `use-habits.ts`).
- **Auth:** Better-Auth React client. Exports: `signIn`, `signUp`, `signOut`, `useSession`.
- **Components:** Shadcn UI base in `components/ui/`. Custom components alongside. Field system in `components/Fields/`.
- **Pages:** Feature-grouped in subdirectories (`tracker/`, `habits-configuration/`, `sessions/`, `auth/`, `analitytics/`).
- **Styling:** Tailwind CSS utility classes. Use `cn()` from `lib/utils` for conditional classes.

### Shared Packages

- **`@trackbit/types`** — Shared interfaces: `Habit`, `Exercise`, `ExerciseSession`, `ExerciseLog`, `ExercisePerformance`, `ColorStop`.
- **`@trackbit/ui`** — Re-exports Shadcn components, custom components (DataTable, Timer, RpeSelector, Form, Fields), ThemeProvider.

### General

- **Fix the root cause, not the symptom.** Never ship quick fixes, band-aids, or defensive patches that only mask a problem. Enforce invariants at their source (e.g. DB default + Zod `.min(1)` at the write boundary instead of guarding every read/render site), and once the root fix makes a compensating patch redundant, remove the patch. When a fix is possible, propose the soundest solution even if it's larger.
- TypeScript strict mode across all packages.
- `tsconfig.base.json` at root, extended by each package.
- Never commit `.env` files. Backend requires `DATABASE_URL`, `BETTER_AUTH_SECRET`.
- Use Zod for all validation — no manual parsing.
- Prefer Drizzle query builder over raw SQL.
- Rate limiting via `rate-limiter-flexible` on sensitive endpoints.

## Database Schema

Key tables in `apps/backend/src/db/schema/`:

| Table | Purpose |
|-------|---------|
| `habits` | Core habit definitions (type, color, goals, icon) |
| `dayLogs` | Daily tracking entries per habit |
| `exercises` | Exercise library (system + user-created) |
| `muscleGroups` | Muscle group taxonomy |
| `exerciseMuscleGroup` | Exercise ↔ muscle group mapping |
| `exerciseSessions` | Workout session grouping |
| `exerciseLogs` | Individual exercise records |
| `exercisePerformances` | Per-set performance data (reps, weight, RPE) |
| `user`, `session`, `account`, `verification` | Better-Auth tables |
| `invites` | Invitation code system |
| `appLimits` | Role-based feature limits |

Habit types: `count`, `complex`, `negative`, `timed`, `check`.

## API Routes

| Route | Method(s) | Purpose |
|-------|-----------|---------|
| `/health` | GET | Health check |
| `/api/auth/*` | * | Better-Auth handler |
| `/api/habits` | GET, POST, PUT | Habit CRUD |
| `/api/tracker/history` | GET | Tracking history (timezone-aware) |
| `/api/exercise-info/exercises` | GET, POST, PATCH, DELETE | Exercise CRUD |
| `/api/exercise-info/musclegroups` | GET, POST | Muscle groups |
| `/api/config/ui` | GET | UI configuration |
| `/admin/invitations` | GET, POST | Invitation management |

## Documentation

See `docs/` for planning:
- `ROADMAP.md` — Long-term vision
- `TODO.md` — Current priorities
- `BACKLOG.md` — Future enhancements
- `TASKS.md` — Detailed task breakdowns
