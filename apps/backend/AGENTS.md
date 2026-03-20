# Backend Guidelines

## Overview

Hono REST API serving both the consumer frontend and admin dashboard. PostgreSQL via Drizzle ORM, Better-Auth for authentication.

## Key Directories

```
src/
├── index.ts                    # App entry, route mounting, CORS config
├── dev.ts                      # Dev server (tsx watch)
├── db/
│   ├── index.ts                # Database connection
│   └── schema/                 # Drizzle schema definitions
│       └── app/                # Application tables
├── routes/
│   ├── app/                    # Consumer API routes (/api/*)
│   │   ├── habits.ts           # Habit CRUD
│   │   ├── tracker.ts          # Tracking & history
│   │   ├── config.ts           # UI configuration
│   │   └── exercise-info/      # Exercise library routes
│   └── admin/
│       └── invites.ts          # Invitation management (/admin/*)
├── middleware/
│   ├── auth.ts                 # requireAuth (sets user + session)
│   ├── require-admin-auth.ts   # requireAdminAuth (role check)
│   └── rateLimit.ts            # Rate limiting
└── lib/
    ├── auth.ts                 # Better-Auth config (email, OAuth, admin plugin)
    ├── email.ts                # Resend email integration
    ├── utils.ts                # Zod error formatter
    ├── init-admin.ts           # Admin seeding
    └── utilities/
        ├── crud-router-factory.ts   # Auto-generates CRUD endpoints
        └── drizzle-crud-schemas.ts  # Zod schema generation from Drizzle
```

## Conventions

### Route Pattern

```typescript
const router = new Hono<AuthEnv>()
router.use('*', requireAuth)
router.get('/', async (c) => {
  const user = c.get('user')
  // ... query with Drizzle
  return c.json(result)
})
router.post('/', zValidator('json', createSchema), async (c) => {
  const body = c.req.valid('json')
  // ... insert with Drizzle
  return c.json(created, 201)
})
```

### Response Format

- Success: `c.json(data)` or `c.json(data, 201)`
- Errors: `c.json({ error: "message" }, 400|401|404|409|500)`
- Validation errors: `c.json({ message: "...", errors: [{ path, message, code }] }, 400)`

### Database Queries

- Use Drizzle query builder, not raw SQL.
- Relations defined via `relations()` — use `db.query.tableName.findMany({ with: {...} })`.
- Timestamps are timezone-aware (`timestamp('...', { withTimezone: true })`).
- JSONB for flexible data (`colorStops` on habits).
- Always scope user data queries by `userId` from auth context.

### CRUD Factory

For standard CRUD resources, use `crud-router-factory.ts`:
- Generates GET (list + detail), POST, PATCH, DELETE
- Supports ownership checks, before-hooks, composite keys
- Paired with `drizzle-crud-schemas.ts` for automatic Zod schemas

### CORS Rules

| Route prefix | Allowed origins |
|-------------|----------------|
| `/api/auth/*` | FRONT_URL + ADMIN_URL |
| `/api/*` | FRONT_URL only |
| `/admin/*` | ADMIN_URL only |

### Auth

- `requireAuth` middleware: extracts session, sets `user` and `session` on Hono context.
- `requireAdminAuth`: extends `requireAuth`, checks `user.role === 'admin'`.
- Better-Auth handles session cookies (`SameSite=None`, `Secure`).
- OAuth providers: Google, GitHub.
- Email verification required for signup.

### Migrations

- Schema changes → run `pnpm db:generate` → produces SQL in `drizzle/`.
- Apply with `pnpm db:migrate`.
- Migration files are numbered sequentially in `drizzle/`.
- Seed data in separate migration files (e.g., `0002_seed_muscle_groups.sql`).
