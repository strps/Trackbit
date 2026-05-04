# Admin App Conventions

Conventions for the admin app at `apps/admin/`. Follow these when adding new features so every page feels consistent.

---

## File structure

Each feature lives in its own folder under `src/features/<feature-name>/`:

```
features/
  issues/
    Issues.tsx              ← page (default export)
    use-admin-issues.ts     ← data hook (all React Query logic)
    components/
      IssueTable.tsx        ← DataTable wrapper
      SomeForm.tsx          ← forms/dialogs
      DeleteConfirm.tsx     ← reusable alert dialog
      LoadingState.tsx      ← loading placeholder
```

---

## Page component

- Default export, named `<Feature>Page`.
- Always wrapped in `<AdminPage>` from `@trackbit/ui`.
- Page-level action buttons are defined as an array and passed to the `pageActions` prop. Compute them with `useMemo` when they depend on state (e.g. active tab).
- Use `<Tabs>` as the primary navigation pattern when the page has multiple views/filters.

```tsx
export default function IssuesPage() {
    const pageActions = React.useMemo(() => [
        { label: "Export", icon: <File className="h-4 w-4" />, variant: "outline" as const, onClick: () => {} },
    ], [activeTab]);

    return (
        <AdminPage title="Issues" description="…" pageActions={pageActions}>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>…</TabsList>
                <div className="mt-4">
                    <TabsContent value="open">…</TabsContent>
                </div>
            </Tabs>
        </AdminPage>
    );
}
```

---

## Data hook

- One hook per feature, named `useAdmin<Feature>`.
- Lives in `use-admin-<feature>.ts` alongside the page.
- Exports TypeScript interfaces for the data shapes (`AdminIssue`, `AdminExercise`, etc.).
- All fetch functions are plain `async` functions outside the hook — the hook only wires them to React Query.
- Use `credentials: "include"` on every fetch call.
- `onSuccess` always calls `invalidateQueries` so the table refreshes automatically.
- Query keys follow the pattern `['admin', '<feature>']`.

```ts
const API_URL = `${import.meta.env.VITE_API_URL}/admin/<feature>`

export interface AdminFoo { id: number; … }

async function fetchFoos(): Promise<AdminFoo[]> {
    const res = await fetch(API_URL, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch foos')
    return res.json()
}

export function useAdminFoos() {
    const queryClient = useQueryClient()
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'foos'] })

    const query = useQuery({ queryKey: ['admin', 'foos'], queryFn: fetchFoos })
    const updateMutation = useMutation({ mutationFn: updateFooFn, onSuccess: invalidate })

    return {
        foos: query.data ?? [],
        isLoading: query.isLoading,
        updateFoo: updateMutation.mutate,
        isUpdating: updateMutation.isPending,
    }
}
```

---

## Tables

- Define columns as `ColumnDef<T>[]` using `buildColumns(…)` — a plain function that receives action callbacks.
- Wrap in a component `<FeatureTable>` that memoises the columns and renders `<Card><CardContent className="py-0 px-2"><DataTable …/></CardContent></Card>`.
- Always include a **select** column (checkbox) and an **actions** column (DropdownMenu with `MoreHorizontal`).
- Use `<DataTableColumnHeader>` for sortable columns.
- Pass `searchColumn` to `DataTable` to enable the search input (use the most useful field — usually name, email, or title).

```tsx
function buildColumns(onEdit: (row: T) => void): ColumnDef<T>[] {
    return [
        { id: "select", /* checkbox … */ },
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
            cell: ({ row }) => <span>{row.getValue("name")}</span>,
        },
        { id: "actions", cell: ({ row }) => <ActionsDropdown row={row.original} onEdit={onEdit} /> },
    ]
}

export function FooTable({ data, onEdit }: Props) {
    const columns = React.useMemo(() => buildColumns(onEdit), [onEdit])
    return (
        <Card>
            <CardContent className="py-0 px-2">
                <DataTable columns={columns} data={data} searchColumn="name" />
            </CardContent>
        </Card>
    )
}
```

---

## Forms & dialogs

- Use `react-hook-form` with `zodResolver` for all forms.
- Define the Zod schema and infer the type in the same file: `type FormValues = z.infer<typeof schema>`.
- Display field errors below the input as `<p className="text-xs text-destructive">{error.message}</p>`.
- The submit button shows a spinner and is disabled while pending.
- Dialogs use local `useState` for open/close — no global modal store.
- Large forms: `<DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">`.
- Destructive actions use `<AlertDialog>` (wrapped as `<DeleteConfirm>`), never a plain confirm dialog.

---

## Badges

Use `<Badge variant="secondary">` with a `className` override for semantic colours:

| Meaning  | Class |
|----------|-------|
| Danger / bug | `bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400` |
| Info / feedback | `bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400` |
| Warning / open | `bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400` |
| Success / resolved | `bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400` |
| Neutral / closed | `bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400` |

---

## Loading state

Inline spinner pattern (no separate component required for simple cases):

```tsx
{isLoading ? (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading <feature>...
    </div>
) : (
    <FeatureTable … />
)}
```

For features with multiple independently-loaded tabs, extract to a `<LoadingState label="…" />` component in `components/`.

---

## Backend routes (admin)

Admin routes live in `apps/backend/src/routes/admin/<feature>.ts`.

- Always apply `requireAdminAuth` middleware: `app.use('*', requireAdminAuth)`.
- Use `zValidator('json', schema)` from `@hono/zod-validator` for request bodies.
- Return `c.json(rows)` for lists and `c.json(updated)` for mutations.
- Register the route in `apps/backend/src/index.ts` under the `app.use('/admin/*', cors(…))` block:
  ```ts
  app.route('/admin/<feature>', adminFeatureRoutes)
  ```
- The CORS origin for admin routes is `process.env.ADMIN_URL`.
- The frontend accesses admin routes at `${import.meta.env.VITE_API_URL}/admin/<feature>` (no `/api/` prefix).

---

## Icons

All icons come from `lucide-react`. Sizing conventions:

| Context | Size class |
|---------|-----------|
| Button / table action | `h-4 w-4` |
| Tab trigger | `w-4 h-4` |
| Avatar / illustration | `h-8 w-8` or `h-9 w-9` |

---

## Sidebar

Add new pages to the `menuItems` array in `apps/admin/src/layouts/AdminLayout.tsx`. Import the icon from `lucide-react` and register the route in `apps/admin/src/main.tsx` inside the `AdminLayout` children array.
