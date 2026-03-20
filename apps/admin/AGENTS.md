# Admin App Guidelines

## Overview

Admin dashboard for managing invitations, users, exercises, and app settings. Separate React app with its own auth flow, restricted to admin-role users.

## Key Directories

```
src/
├── main.tsx
├── pages/
│   ├── Dashboard.tsx         # Admin overview
│   ├── Users.tsx             # User management
│   ├── Invitations.tsx       # Invitation code management
│   ├── Exercises.tsx         # Exercise library management
│   ├── Settings.tsx          # App settings
│   ├── Icons.tsx             # Icon browser
│   ├── Home.tsx              # Landing
│   ├── auth/                 # Admin auth pages
│   ├── 404.tsx, Error.tsx
├── forms/
│   └── InvitationCode.tsx    # Invitation form
├── layouts/
│   ├── AdminLayout.tsx       # Authenticated admin layout
│   └── AuthLayout.tsx        # Auth layout
└── lib/
    ├── auth-client.ts        # Better-Auth client (admin origin)
    ├── colorUtils.ts
    └── utils.ts
```

## Conventions

- Uses `@trackbit/ui` shared components (AdminPage, DataTable, etc.).
- TanStack React Table for data grids.
- API calls target `/admin/*` endpoints on the backend.
- Auth uses same Better-Auth client, but configured with admin origin.
- Backend CORS restricts `/admin/*` routes to `ADMIN_URL` origin only.
