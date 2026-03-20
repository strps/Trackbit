# trackbit

A hybrid habit tracker and workout logger for the modern web.

**trackbit** bridges the gap between simple habit checkboxes (_"Did I read today?"_) and complex activity logging (_"Bench Press: 3×10 @ 80 kg"_). It features GitHub-style heatmaps, real-time optimistic UI, and deep analytics — all in a single unified interface.

## Key Features

- **Hybrid Data Model** — Track binary habits alongside data-rich activities (workouts, reading, hydration).
- **Interactive Heatmaps** — GitHub-style gradient visualizations for consistency tracking.
- **Optimistic UI** — Instant feedback via TanStack Query, snappy even on slow networks.
- **Exercise Library** — Built-in exercise database with support for custom creations.
- **Gradient Progress** — Color intensity increases as you approach daily targets.
- **Secure Auth** — Email/password authentication powered by Better-Auth.
- **Admin Dashboard** — Separate admin app with invitation management and data oversight.
- **E-Invoicing** — Costa Rican Hacienda v4.4 compliance via dedicated client package.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TypeScript |
| State & Data | TanStack Query (React Query) |
| Styling | Tailwind CSS, Shadcn UI, Radix UI |
| Backend | Hono (Node.js) |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Better-Auth |
| Validation | Zod |
| Email | React-Email + Resend |
| Monorepo | pnpm workspaces + Turborepo |
| Deployment | Vercel |

## Project Structure

```
trackbit/
├── apps/
│   ├── frontend/              # Consumer-facing habit tracker (React + Vite)
│   ├── backend/               # REST API server (Hono + PostgreSQL)
│   └── admin/                 # Admin dashboard (React + Vite)
├── packages/
│   ├── ui/                    # Shared UI components (Shadcn-based)
│   ├── types/                 # Shared TypeScript type definitions
│   └── hacienda-client/       # Costa Rican e-invoicing client (v4.4)
├── docs/                      # Project planning & documentation
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js v18+
- pnpm v10+
- PostgreSQL (local or cloud)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/trackbit.git
cd trackbit

# Install all dependencies (monorepo-aware)
pnpm install
```

### Environment Setup

Create `.env` in `apps/backend/`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/trackbit_db"
BETTER_AUTH_SECRET="your_generated_secret_here"
PORT=3000
```

### Database Setup

```bash
# Generate and apply migrations
pnpm --filter backend db:generate
pnpm --filter backend db:migrate
```

### Development

```bash
# Start all apps concurrently
pnpm dev

# Or start individually
pnpm dev:frontend     # http://localhost:5173
pnpm dev:backend      # http://localhost:3000
```

### Database Commands

```bash
pnpm --filter backend db:generate   # Generate Drizzle migrations
pnpm --filter backend db:migrate    # Apply migrations
pnpm --filter backend db:push       # Push schema directly to DB
pnpm --filter backend db:studio     # Launch Drizzle Studio GUI
pnpm --filter backend db:pull       # Pull existing schema from DB
```

### Building

```bash
pnpm build            # Build all packages and apps
pnpm lint:all         # Lint all workspaces
```

## API Overview

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Health check |
| `/api/auth/*` | Authentication (Better-Auth) |
| `/api/habits` | Habit CRUD |
| `/api/tracker` | Activity tracking & logging |
| `/api/exercise-info` | Exercise library |
| `/api/config` | App configuration |
| `/admin/invitations` | Invitation management (admin) |

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full roadmap. Current priorities:

- [ ] Data analysis — correlation engines to find patterns between habits
- [ ] Mobile polish — enhanced touch support for mobile browsers
- [ ] Social features — optional leaderboards for accountability
- [ ] Export — JSON/CSV export for data sovereignty
- [ ] Hacienda v4.4 — complete e-invoicing integration

## Documentation

| Document | Description |
|----------|-------------|
| [ROADMAP.md](docs/ROADMAP.md) | Long-term vision and milestones |
| [TODO.md](docs/TODO.md) | Current high-priority tasks |
| [BACKLOG.md](docs/BACKLOG.md) | Future enhancements |
| [TASKS.md](docs/TASKS.md) | Detailed task breakdowns |
| [AGENTS.md](AGENTS.md) | AI agent instructions for this codebase |

