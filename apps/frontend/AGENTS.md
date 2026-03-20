# Frontend Guidelines

## Overview

Consumer-facing React app for habit tracking, workout logging, and analytics. Built with React 19, Vite, TanStack Query, Tailwind CSS, and Shadcn UI.

## Key Directories

```
src/
├── main.tsx                     # App entry point
├── index.css                    # Global styles (Tailwind)
├── pages/
│   ├── tracker/                 # Main tracker view (TrackerHome, use-tracker)
│   ├── habits-configuration/    # Habit management (form, list, color/icon fields)
│   ├── sessions/                # Workout sessions (exercise panels)
│   ├── analitytics/             # Analytics dashboard (stats, charts)
│   ├── auth/                    # Auth pages (sign in/up, password reset, verify)
│   ├── Landing.tsx              # Public landing page
│   ├── ExerciseLibrary.tsx      # Exercise browser
│   ├── 404.tsx, Error.tsx       # Error pages
├── components/
│   ├── ui/                      # Shadcn primitives (button, dialog, card, etc.)
│   ├── Fields/                  # Form field components (TextField, NumberField, etc.)
│   ├── Heatmap.tsx              # GitHub-style activity heatmap
│   ├── GradientPicker.tsx       # Color gradient configuration
│   ├── Timer.tsx                # Timed habit component
│   ├── NumericStepper.tsx       # Increment/decrement counter
│   └── ...                      # BigButton, EmptyState, Header, etc.
├── hooks/
│   ├── use-config.ts            # App configuration
│   └── use-exercises.ts         # Exercise data
├── layouts/
│   ├── AppLayout.tsx            # Authenticated layout
│   └── AuthLayout.tsx           # Auth pages layout
├── lib/
│   ├── auth-client.ts           # Better-Auth React client
│   ├── colorUtils.ts            # Color manipulation
│   ├── dateUtilities.ts         # Date helpers
│   └── utils.ts                 # cn() utility, general helpers
└── providers/
    ├── theme-provider.tsx       # Dark/light theme
    └── ui-provider.tsx          # UI context
```

## Conventions

### Data Fetching

- TanStack Query for all server state. Optimistic updates where possible.
- Page-level hooks colocated with pages (e.g., `tracker/use-tracker.ts`).
- Global hooks in `src/hooks/` for cross-page data.

### Auth

```typescript
import { signIn, signUp, signOut, useSession } from '@/lib/auth-client'
```

Better-Auth React client. Session check via `useSession()`. Auth state drives layout rendering.

### Components

- **Shadcn base** in `components/ui/` — never modify directly, regenerate with CLI.
- **Custom components** alongside `ui/` at `components/` level.
- **Field system** in `components/Fields/` — wraps inputs with labels, errors, descriptions.
- **Shared components** from `@trackbit/ui` package for cross-app reuse.

### Styling

- Tailwind CSS utility classes everywhere.
- `cn()` from `lib/utils` for conditional class merging.
- CSS variables for theming (defined in `index.css`).
- `next-themes` for dark mode toggle.

### Page Organization

Pages are feature-grouped in subdirectories. Each directory may contain:
- Page component (`TrackerHome.tsx`)
- Data hook (`use-tracker.ts`)
- Utility functions (`utils.ts`)
- Sub-components specific to that feature

### Imports

- Use `@/` path alias for `src/` imports.
- Import shared types from `@trackbit/types`.
- Import shared UI from `@trackbit/ui`.
