# Exercise Info, Media & Variants

Three features about what an exercise *is*, not about logging it:

1. **Exercise info** — the Info button on the session log card opens a sheet with the exercise's main information, then its instructions, then everything else. Web and Android.
2. **Media** — optional images or short animations per exercise.
3. **Variants** — each exercise lists its variants (Bench Press → Incline Bench Press, Dumbbell Bench Press…).

Branch: `feat/exercise-info` (from `dev`).

Current state:

- Web: [ExerciseLogCard.tsx](../../../apps/frontend/src/features/activity-tracker/components/ExerciseLogCard.tsx) and [ExerciseLogCardCompact.tsx](../../../apps/frontend/src/features/activity-tracker/components/ExerciseLogCardCompact.tsx) render `<Button variant="ghost"><Info /></Button>` with no handler. It also sits inside the `CollapsibleTrigger`, so a click toggles the card.
- Android: [ExerciseLogCards.kt](../../../apps/android/feature/session/src/main/kotlin/com/trackbit/feature/session/ExerciseLogCards.kt) `LogHeader` has no Info button.
- Data: `exercises` has only `description` / `descriptionI18n` (≤ 500 chars). It has no instructions, media or variant link. Muscle groups exist (`exercise_muscle_groups.role` is `primary` | `secondary`). The backend has no file storage.

---

## Decisions

Confirmed 2026-10-12.

| # | Decision | Recommendation | Why |
|---|---|---|---|
| D1 | Instructions shape | **Ordered list of steps** (`string[]`), separate from `description` | The sheet renders numbered steps. `description` stays the short "what it is" text. Free text would need parsing to number it. |
| D2 | Variant model | **`variant_of_id` self-reference on `exercises`, one level deep** (a base and its variants) | A variant is a real exercise with its own logs, PRs and analytics, so it must be an `exercises` row. One parent per variant gives a family (the base plus its siblings) with no graph to walk. A many-to-many "related" table can't say which exercise is the base. |
| D3 | Variant discovery | **Derived on the client from the catalog** (`GET /exercises` already returns every visible exercise) | No new endpoint, and Android gets it offline for free from Room. |
| D4 | Media format | **Images only: static WebP/JPEG/PNG and animated WebP** (no video) | `<img>` and Coil render both, so neither client needs a video player (ExoPlayer). Animated WebP is far smaller than GIF. |
| D5 | Media storage | **Vercel Blob** (`@vercel/blob`), behind a small `MediaStore` interface in `lib/` | It's already on Vercel, so there's no new vendor. Uploads go straight from the browser to Blob with a backend-signed token, so large bodies never pass through the function. The interface keeps S3/R2 swappable. |
| D6 | Who adds media | **Admin only (system exercises) first.** User uploads for custom exercises come later, behind role limits. | User uploads need quotas (`appLimits`), cleanup on delete and moderation. Shipping system media first proves the pipeline. |
| D7 | Who sets the info / variant-of | Admin for system exercises. **Users for their own custom exercises** (everything but media: text and enums, no storage cost). A user may mark a custom exercise as a variant of a system exercise or of one of their own. | This is the useful case: "my Smith-machine bench is a Bench Press variant". |
| D8 | "Other information" | Anything helpful while doing the exercise: **equipment**, **difficulty**, **tips**, **common mistakes**, and **the last time it was performed** (date + that log's sets) | Confirmed by the user. Variants are named by their own exercise name; no separate label. |

---

## Data model (backend)

### `exercises` — new columns

```ts
// Ordered steps. User exercises use `instructions`; system ones use `instructionsI18n`, like name/description.
instructions: jsonb('instructions').$type<string[]>(),
instructionsI18n: jsonb('instructions_i18n').$type<Record<string, string[]>>(),

// Same shape and rules as instructions: helpful cues, and what to avoid.
tips: jsonb('tips').$type<string[]>(),
tipsI18n: jsonb('tips_i18n').$type<Record<string, string[]>>(),
commonMistakes: jsonb('common_mistakes').$type<string[]>(),
commonMistakesI18n: jsonb('common_mistakes_i18n').$type<Record<string, string[]>>(),

// A fixed vocabulary the clients translate (like category): barbell, dumbbell, kettlebell,
// machine, cable, bodyweight, band, bench, pull_up_bar, other. Empty array, never null.
equipment: text('equipment').array().notNull().default(sql`'{}'::text[]`),
// beginner | intermediate | advanced; null when unrated.
difficulty: text('difficulty'),

// The base exercise this is a variant of; null for a base (or an exercise with no family).
variantOfId: integer('variant_of_id').references((): AnyPgColumn => exercises.id, { onDelete: 'set null' }),
```

These invariants are enforced at the source, not at read sites (per AGENTS.md):

- **No empty step lists** (instructions, tips, common mistakes). A blank entry or an empty array is never stored. Zod trims, drops blank entries and turns `[]` into `null`, and DB checks back it up (`jsonb_array_length(...) > 0`, and the same for every locale in the `*I18n` objects via the trigger below). Limits: ≤ 20 entries, ≤ 300 chars each. Shared by the web and Android forms and the server, like `ExerciseRules`.
- **Equipment and difficulty from their vocabularies**: DB checks `equipment <@ ARRAY[...]` and `difficulty IN (...)`, the same lists as the Zod enums. Equipment is deduplicated at the write boundary.
- **No self-reference**: DB check `variant_of_id IS DISTINCT FROM id`.
- **One level deep, visibility-safe**. These rules span rows, so a CHECK can't hold them. They go in a `BEFORE INSERT OR UPDATE` trigger (migration SQL), so admin, user routes and any future writer all get them:
  - the target exists and is not itself a variant (`variant_of_id IS NULL`);
  - the row being changed has no variants of its own (a base can't become a variant);
  - a **system** exercise may only point at a system exercise;
  - a **user** exercise may only point at a system exercise or one of the same user's exercises.
  The route maps the trigger's SQLSTATE to a 400 `{ error: 'invalid_variant_of' }`. The route also checks up front for a readable message, but the trigger is what guarantees the rules.
- Index on `variant_of_id`.

### `exercise_media` — new table

```ts
export const exerciseMedia = pgTable('exercise_media', {
    id: serial('id').primaryKey(),
    uuid: uuid('uuid').defaultRandom().notNull().unique(),
    exerciseId: integer('exercise_id').references(() => exercises.id, { onDelete: 'cascade' }).notNull(),
    url: text('url').notNull(),               // public Blob URL
    storageKey: text('storage_key').notNull(), // for deletion
    mimeType: text('mime_type').notNull(),    // image/webp | image/jpeg | image/png
    animated: boolean('animated').notNull().default(false),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    bytes: integer('bytes').notNull(),
    position: integer('position').notNull(),  // 0 = cover, shown first
    altI18n: jsonb('alt_i18n').$type<Record<string, string>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
    uniqueIndex('exercise_media_position').on(t.exerciseId, t.position),
    check('exercise_media_mime', sql`mime_type IN ('image/webp','image/jpeg','image/png')`),
]);
```

- At most **6 media per exercise**, ≤ **2 MB** each (enforced by the upload token's `maximumSizeInBytes` / `allowedContentTypes` and again when the row is recorded).
- Deleting a row (or its exercise, by cascade) must delete the blob. Delete the blob in the same route after the row is gone. A periodic sweep of orphan keys can come later and goes in BACKLOG; it is not part of this plan.
- Migration `0018_exercise_info.sql` via `pnpm --filter backend db:generate`, then the trigger appended by hand in the same file. Remember the 0008 lesson: keep the migration atomic.

### API shape — `GET /api/exercise-info/exercises`

Each row gains:

```ts
instructions: string[] | null          // COALESCE(instructions_i18n->locale, ->'en', instructions)
tips: string[] | null                  // localized the same way
commonMistakes: string[] | null        // localized the same way
equipment: string[]                    // vocabulary keys; clients translate
difficulty: 'beginner' | 'intermediate' | 'advanced' | null
recentLogs: { uuid, localDay, sets: { reps, weight, duration, distance, rpe }[] }[]
                                       // the user's 2 most recent logs of it that have sets, newest first;
                                       // the sheet shows the first that isn't the log it was opened from
variantOfId: number | null
variantOfUuid: string | null           // Android names exercises by uuid
media: { uuid, url, animated, width, height, alt: string | null }[]  // ordered by position, alt localized
```

`recentLogs` are the user's latest logs with sets of each exercise (scoped to their habits, like `lastPerformance`) and their sets in order, loaded in a second query. Media is loaded in a further query keyed by exercise ids, like `muscleGroups` in `loadExercises`. The variant uuid comes from a self left-join.

Shared type: extend `Exercise` in [packages/types](../../../packages/types/src/index.ts) with `instructions`, `variantOfId`, `variantOfUuid`, `media: ExerciseMedia[]`.

### Write endpoints

| Route | Change |
|---|---|
| `POST/PATCH /api/exercise-info/exercises` (+ `/uuid/:uuid`) | Accept `instructions`, `tips`, `commonMistakes` (nullable, optional; same Zod "nullable not nullish" care as `description`) and `variantOfUuid` (nullable). Resolve the uuid → id with `ownExerciseIdByUuid`-style visibility. |
| `/admin/exercises` POST/PUT | Accept `instructions`, `tips`, `commonMistakes` as `{ en?: string[], es?: string[] }` → the `*I18n` columns, plus `equipment`, `difficulty` and `variantOfId`. |
| `POST /admin/exercises/:id/media/upload-token` | `@vercel/blob/client` `handleUpload`: admin only, fixed content types and size, pathname `exercises/{exerciseUuid}/{random}`. |
| `POST /admin/exercises/:id/media` | Records an uploaded blob (url, key, dims, animated, alt). The server re-checks the blob's size and type with `head()`, so a client can't lie. |
| `PATCH /admin/exercises/:id/media/order` | Reorders by uuids; rewrites `position` in one transaction. |
| `DELETE /admin/exercises/:id/media/:uuid` | Deletes the row, then the blob. |

Env: `BLOB_READ_WRITE_TOKEN` (Vercel project). Add it to the backend env docs; it is never committed.

---

## The info sheet (both clients)

The same layout and order on web and Android:

1. **Header / main**: media carousel (cover first; animated ones loop; nothing when there's no media), name, category and difficulty chips, **primary** muscle groups (secondary ones as muted chips), equipment.
2. **Instructions**: a numbered list of steps. When there are none, show "No instructions yet", plus an "Add instructions" link for an owned custom exercise.
3. **Other information**:
   - **Last time**: the date it was last performed and that log's sets (from `recentLogs`, skipping the log the sheet was opened from); "Never performed" otherwise.
   - **Tips** and **Common mistakes** (bulleted, each only if present).
   - Description (if any).
   - **Variants**: the family as tappable chips, i.e. the base plus its siblings, minus the current exercise. Tapping one shows that exercise's info in the same sheet, with a back affordance.

Entry points: the Info button on the log card (normal and compact), and the exercise library row. The picker gets one later (see Phase 6).

Family derivation (pure function, unit-tested on each client):

```
base   = exercise.variantOfId ? byId(exercise.variantOfId) : exercise
family = [base, ...catalog.filter(e => e.variantOfId === base.id)] minus exercise
```

---

## Phases

Each phase is shippable and gets its own commit(s) on this branch.

### Phase 1 — Backend: info fields + variants

- [x] Schema columns, checks and index; trigger; migration `0018`.
- [x] Zod: shared `stepListSchema` (trim, drop blanks, `[]`→`null`, limits), equipment/difficulty enums; user create/update; admin create/update.
- [x] `loadExercises`: the info fields, `variantOfId`, `variantOfUuid`, `recentLogs`.
- [x] Admin GET returns the `*I18n` info columns, `equipment`, `difficulty`, `variantOfId`.
- [x] Tests (Vitest): blank steps dropped; `[]` → null; >20 steps → 400; unknown equipment / difficulty → 400; `recentLogs` are the user's own 2 latest logs with sets, sets in order, empty logs skipped; self / chain / base-becomes-variant / system→user / user→other user's all rejected (both route and raw insert hit the trigger); `ON DELETE SET NULL` on the base; locale fallback for instructions.
- [x] `packages/types` updated; AGENTS.md API table untouched (same routes).
- [x] Android contracts re-recorded with real info values, plus `invalid-variant-of.json` (mapped to a plain `ApiError.Validation` until Phase 4 decides otherwise).

Notes: the variant trigger lives in [exercise-variant-rules.sql](../../../apps/backend/src/db/sql/exercise-variant-rules.sql). Migration 0018 carries it verbatim and the test setup applies it after `pushSchema`; a test fails if the two drift apart. Step-list, equipment and difficulty rules are Drizzle `check()`s and `pgEnum`s, so the push creates them.

### Phase 2 — Web: info sheet

- [ ] `ExerciseInfoSheet` in `features/exercise-library/` (Dialog on desktop, Drawer/Sheet on mobile), with `getExerciseFamily` util + test.
- [ ] Wire the Info button in `ExerciseLogCard` and `ExerciseLogCardCompact`. Move it out of the `CollapsibleTrigger` hit area, or `stopPropagation` like the Start button. Give it an `aria-label`.
- [ ] Library row opens the same sheet.
- [ ] Custom exercise form: list editors for instructions, tips and common mistakes (add / remove / reorder), equipment multi-select, difficulty select, and a "Variant of" combobox (system + own base exercises, excluding itself and its own variants).
- [ ] i18n keys in `en` and `es` (`exercises` namespace; keep the bundles symmetric).

### Phase 3 — Admin: instructions, variants, media

- [ ] `ExerciseForm.tsx`: per-locale step lists (en and es, both optional; the client falls back to en), "Variant of" select (system bases only).
- [ ] Media manager: upload (`@vercel/blob/client` `upload()` with the token route); read width, height and animated status in the browser before recording; drag to reorder; delete; alt text en/es.
- [ ] Backend media routes + `MediaStore` (Blob impl; a fake in tests) + tests (admin only, limit of 6, type/size re-check, order rewrite, blob deleted on row delete and on exercise delete).
- [ ] `loadExercises` adds `media`; the web sheet's carousel renders it (`<img loading="lazy">`, `width`/`height` set to avoid layout shift).

### Phase 4 — Android: data

Coordinate with the Kotlin plan ([kotlin-app-F.md](../handoffs/kotlin-app-F.md)). F5 moves exercise writes to the outbox with per-field LWW, so `instructions` and `variantOfUuid` must be fields in that model. Land this phase after F5, or add the fields to F5's scope. Don't build a second write path.

- [ ] `core/model` `Exercise`: `instructions`, `tips`, `commonMistakes` (`List<String>? = null`), `equipment: List<String> = emptyList()`, `difficulty: String? = null`, `variantOfUuid: String? = null`, `recentLogs: List<RecentLog> = emptyList()`, `media: List<ExerciseMediaRef> = emptyList()`.
- [ ] `ExerciseEntity` + converters + Room **v10 → v11** migration (new columns, JSON defaults) + `MigrationTest`. The sheet's "Last time" prefers a newer local log from Room (logged offline) over the server's `recentLogs`.
- [ ] `ExerciseRules`: instruction limits mirrored from the server; `ExerciseRequest` carries the new fields.
- [ ] Repository / sync tests updated.

### Phase 5 — Android: info sheet

- [ ] Add **Coil 3** (`coil-compose`, `coil-network-okhttp` on the app's OkHttp so the auth/cache setup is shared, `coil-gif` for `AnimatedImageDecoder`). Use a disk cache so media seen once works offline. On API 26–27, animated WebP shows its first frame (`ImageDecoder` needs API 28); that's acceptable and documented.
- [ ] `ExerciseInfoSheet` (ModalBottomSheet) with a family helper and unit test. Put it where both `feature/session` and `feature/exercise-library` can use it: a small `feature/exercise-info` module, or `core/designsystem` if it stays model-only. Decide by the existing module dependency rules.
- [ ] `LogHeader`: Info `IconButton` before the overflow menu, in both the normal and the compact card (shown even when the card is disabled, because reading is always allowed).
- [ ] Library row opens the sheet; custom exercise form gets the list editors, equipment, difficulty and the "Variant of" picker.
- [ ] Strings in `core/i18n` (en + es).

### Phase 6 — Later (not in this branch unless asked)

- **Swap to variant** on the log card: needs `PATCH /api/tracker/exercise-logs/uuid/:uuid { exerciseUuid }` (only within the same family), plus an Android outbox op. It's valuable mid-workout ("bench is taken, do dumbbell"), but it is a tracker-write change with its own sync story.
- Picker groups variants under their base.
- Analytics: optional "combine family" toggle.
- User-uploaded media for custom exercises: `appLimits.maxExerciseMedia`, storage quota, deletion cascade, moderation.
- Content: write instructions and media for the system catalog (en + es). This is content work, tracked separately.
- Orphan-blob sweep.

---
