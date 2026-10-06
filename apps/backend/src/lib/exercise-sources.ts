import { and, asc, eq, getTableColumns, inArray } from 'drizzle-orm'
import type {
    ExerciseSourceDescriptor,
    ExerciseSourceRef,
    Prescription,
    QueueEntry,
    ResolvedQueue,
    SourceCapabilities,
} from '@trackbit/types'
import { serializeSourceKey } from '@trackbit/types'
import db from '../db/db.js'
import { exerciseListItems, exerciseLists } from '../db/schema/app/exercise-lists.js'
import { exercises } from '../db/schema/app/exercises.js'
import { computeFrozenListIds, computeFrozenListsForUser, getEffectiveLimits } from './user-limits.js'

// Resolution for every exercise source kind lives here. Adding a kind (Phase 4
// programs, Phase 5 computed strategies) means adding a branch here and nothing
// else: the two endpoints and the picker both stay untouched.

/** An item with its exercise's uuid, which clients that name exercises by uuid read. */
export type ListItemRow = typeof exerciseListItems.$inferSelect & { exerciseUuid: string }
type ListRow = typeof exerciseLists.$inferSelect

/** Items with their exercise's uuid; add `.where(…).orderBy(…)`. */
export function selectItems(tx: Pick<typeof db, 'select'> = db) {
    return tx
        .select({ ...getTableColumns(exerciseListItems), exerciseUuid: exercises.uuid })
        .from(exerciseListItems)
        .innerJoin(exercises, eq(exercises.id, exerciseListItems.exerciseId))
}

function prescriptionOf(item: ListItemRow): Prescription | null {
    const prescription: Prescription = {
        targetSets: item.targetSets,
        targetReps: item.targetReps,
        targetWeight: item.targetWeight,
        targetDuration: item.targetDuration,
        targetDistance: item.targetDistance,
        restSeconds: item.restSeconds,
        notes: item.notes,
    }

    // "No prescription" is one representation, not seven nulls in a trench coat.
    const hasAny = Object.values(prescription).some((value) => value !== null)
    return hasAny ? prescription : null
}

// Every capability is derived at read time — never stored, so it can't disagree
// with the data it describes.
function capabilitiesOf(ref: ExerciseSourceRef, frozen: boolean, prescribes: boolean): SourceCapabilities {
    const isList = ref.kind === 'list'
    return {
        canAppend: isList && !frozen,
        canReorder: isList && !frozen,
        prescribes,
        isDynamic: !isList,
    }
}

function listDescriptor(list: ListRow, items: ListItemRow[], frozen: boolean): ExerciseSourceDescriptor {
    const ref: ExerciseSourceRef = { kind: 'list', listUuid: list.uuid }
    const prescribes = items.some((item) => prescriptionOf(item) !== null)

    return {
        ref,
        key: serializeSourceKey(ref),
        name: list.name,
        itemCount: items.length,
        capabilities: capabilitiesOf(ref, frozen, prescribes),
        frozen,
    }
}

function toQueueEntries(items: ListItemRow[]): QueueEntry[] {
    return items.map((item) => ({
        exerciseId: item.exerciseId,
        exerciseUuid: item.exerciseUuid,
        position: item.position,
        listItemId: item.id,
        listItemUuid: item.uuid,
        prescription: prescriptionOf(item),
    }))
}

export interface ListWithItems {
    list: ListRow
    items: ListItemRow[]
}

// Loaders use explicit selects rather than a relational `with`: nested relation
// results infer as `{ [k: string]: any }` against this schema, which silently
// erases the item type at every call site downstream.

// Every list the user owns, each with its items in position order.
export async function loadOwnedListsWithItems(userId: string): Promise<ListWithItems[]> {
    const lists = await db
        .select()
        .from(exerciseLists)
        .where(eq(exerciseLists.userId, userId))
        .orderBy(asc(exerciseLists.position), asc(exerciseLists.id))

    if (lists.length === 0) return []

    const items = await selectItems()
        .where(inArray(exerciseListItems.listId, lists.map((list) => list.id)))
        .orderBy(asc(exerciseListItems.listId), asc(exerciseListItems.position))

    const byList = new Map<number, ListItemRow[]>(lists.map((list) => [list.id, []]))
    for (const item of items) {
        byList.get(item.listId)?.push(item)
    }

    return lists.map((list) => ({ list, items: byList.get(list.id) ?? [] }))
}

// One list the user owns (by id or uuid), or null — the single guard every read
// path funnels through, so an unknown or unowned id is always indistinguishable from absent.
export async function loadOwnedListWithItems(
    userId: string,
    list: { id: number } | { uuid: string }
): Promise<ListWithItems | null> {
    const [row] = await db
        .select()
        .from(exerciseLists)
        .where(and('id' in list ? eq(exerciseLists.id, list.id) : eq(exerciseLists.uuid, list.uuid), eq(exerciseLists.userId, userId)))
        .limit(1)

    if (!row) return null

    const items = await selectItems()
        .where(eq(exerciseListItems.listId, row.id))
        .orderBy(asc(exerciseListItems.position))

    return { list: row, items }
}

// GET /api/exercise-sources — everything the user can currently pick from.
// Phase 1 lists only `list:` sources; programs and computed strategies append
// themselves here in later phases with no change on the consuming side.
export async function listExerciseSources(
    userId: string,
    role: string | null | undefined
): Promise<ExerciseSourceDescriptor[]> {
    const rows = await loadOwnedListsWithItems(userId)

    const limits = await getEffectiveLimits(role)
    const frozen = computeFrozenListIds(rows.map((row) => row.list), limits)

    return rows.map((row) => listDescriptor(row.list, row.items, frozen.has(row.list.id)))
}

// Resolves a ref to its queue, or null when the ref is unknown, unowned, or of a
// kind this version cannot resolve yet. Callers turn null into a 404, which the
// client reads as "fall back to browse mode" rather than as an error.
export async function resolveExerciseSource(
    userId: string,
    role: string | null | undefined,
    ref: ExerciseSourceRef
): Promise<ResolvedQueue | null> {
    if (ref.kind !== 'list') {
        // Programs arrive in Phase 4, computed strategies in Phase 5.
        return null
    }

    const found = await loadOwnedListWithItems(userId, { uuid: ref.listUuid })
    if (!found) return null

    const { list, items } = found
    const frozenLists = await computeFrozenListsForUser(userId, role)
    const entries = toQueueEntries(items)

    return {
        descriptor: listDescriptor(list, items, frozenLists.has(list.id)),
        entries,
        ...(entries.length === 0 && { emptyReason: 'list_empty' as const }),
        generatedAt: new Date().toISOString(),
    }
}
