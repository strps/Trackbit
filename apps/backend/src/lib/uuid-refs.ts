import { HTTPException } from 'hono/http-exception'
import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import { z } from 'zod'
import db from '../db/db.js'
import { exerciseListItems, exerciseLists, exercises, habits } from '../db/schema/index.js'

// Rows a client may create offline (habits, exercises, lists, list items, and the tracker's
// sessions, logs and sets) carry a `uuid` it can choose. Such a client names them by uuid in every
// request (`habitUuid` beside `habitId`, `/uuid/:uuid` beside `/:id`), and a create retried with
// the same uuid answers with the row it made the first time. The web keeps using int ids.

/** Exactly one of [a] and [b]: a row given by id or by uuid. */
export const oneOf = (a: string, b: string) => (body: Record<string, unknown>) => (body[a] == null) !== (body[b] == null)

/** At most one of [a] and [b]: an optional row given by id or by uuid. */
export const atMostOne = (a: string, b: string) => (body: Record<string, unknown>) => body[a] == null || body[b] == null

export const uuidParamSchema = z.object({ uuid: z.uuid() })

export function uuidConflictException() {
    return new HTTPException(409, {
        res: Response.json({ error: 'uuid_conflict', message: 'This uuid already names another row.' }, { status: 409 }),
    })
}

/**
 * For a create given [uuid]: the row it already made, or undefined if there is none (or no uuid
 * was given). A uuid naming someone else's row is a 409.
 */
export async function createdBefore<T extends { userId: string | null }>(
    uuid: string | undefined,
    find: (uuid: string) => Promise<T[]>,
    userId: string,
): Promise<T | undefined> {
    if (uuid === undefined) return undefined
    const [row] = await find(uuid)
    if (row && row.userId !== userId) throw uuidConflictException()
    return row
}

// Uuid → id for the user's own rows (or ones they may use: system exercises). Undefined when the
// uuid names nothing they can see, which callers answer like an unknown id.

export async function habitIdByUuid(userId: string, uuid: string): Promise<number | undefined> {
    const [row] = await db.select({ id: habits.id }).from(habits)
        .where(and(eq(habits.uuid, uuid), eq(habits.userId, userId))).limit(1)
    return row?.id
}

/** A system exercise or the user's own. */
export async function visibleExerciseIdByUuid(userId: string, uuid: string): Promise<number | undefined> {
    const [row] = await db.select({ id: exercises.id }).from(exercises)
        .where(and(eq(exercises.uuid, uuid), or(isNull(exercises.userId), eq(exercises.userId, userId)))).limit(1)
    return row?.id
}

/** Only the user's own exercise (the ones they may edit or delete). */
export async function ownExerciseIdByUuid(userId: string, uuid: string): Promise<number | undefined> {
    const [row] = await db.select({ id: exercises.id }).from(exercises)
        .where(and(eq(exercises.uuid, uuid), eq(exercises.userId, userId))).limit(1)
    return row?.id
}

export async function listIdByUuid(userId: string, uuid: string): Promise<number | undefined> {
    const [row] = await db.select({ id: exerciseLists.id }).from(exerciseLists)
        .where(and(eq(exerciseLists.uuid, uuid), eq(exerciseLists.userId, userId))).limit(1)
    return row?.id
}

/** An item of one of the user's lists. */
export async function listItemIdByUuid(userId: string, uuid: string): Promise<number | undefined> {
    const [row] = await db.select({ id: exerciseListItems.id }).from(exerciseListItems)
        .innerJoin(exerciseLists, eq(exerciseLists.id, exerciseListItems.listId))
        .where(and(eq(exerciseListItems.uuid, uuid), eq(exerciseLists.userId, userId))).limit(1)
    return row?.id
}

/**
 * Each exercise's uuid by id, and the same for list items: what responses add beside an int
 * reference so a client that names rows by uuid can read it.
 */
export async function exerciseUuids(ids: Iterable<number>): Promise<Map<number, string>> {
    const unique = [...new Set(ids)]
    if (unique.length === 0) return new Map()
    const rows = await db.select({ id: exercises.id, uuid: exercises.uuid }).from(exercises).where(inArray(exercises.id, unique))
    return new Map(rows.map((row) => [row.id, row.uuid]))
}

export async function listItemUuids(ids: Iterable<number | null>): Promise<Map<number, string>> {
    const unique = [...new Set([...ids].filter((id): id is number => id != null))]
    if (unique.length === 0) return new Map()
    const rows = await db.select({ id: exerciseListItems.id, uuid: exerciseListItems.uuid }).from(exerciseListItems)
        .where(inArray(exerciseListItems.id, unique))
    return new Map(rows.map((row) => [row.id, row.uuid]))
}

/** [log] with `exerciseUuid` and `listItemUuid` beside its int references. */
export function withLogUuids<T extends { exerciseId: number; listItemId: number | null }>(
    log: T,
    exerciseUuid: Map<number, string>,
    listItemUuid: Map<number, string>,
) {
    return {
        ...log,
        exerciseUuid: exerciseUuid.get(log.exerciseId)!,
        listItemUuid: log.listItemId == null ? null : listItemUuid.get(log.listItemId) ?? null,
    }
}
