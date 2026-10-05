import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import db from '../src/db/db.js'
import { exerciseListItems, exerciseLists, exercises } from '../src/db/schema/index.js'
import { app, bearer, post, signedInUser } from './helpers.js'

const get = (token: string, path: string) => app.request(path, bearer(token))
const send = (token: string, method: string, path: string, body?: unknown) =>
    app.request(path, bearer(token, { method, ...(body !== undefined && { body: JSON.stringify(body) }) }))

const LISTS = '/api/exercise-lists'

async function exercise(name = `Exercise ${Math.random()}`, userId: string | null = null) {
    const [row] = await db.insert(exercises).values({ name, userId, category: 'strength' }).returning()
    return row
}

async function createList(token: string, name: string) {
    const res = await post(token, LISTS, { name })
    expect(res.status).toBe(201)
    return (await res.json()) as { id: number; position: number }
}

/** A user over the default role's cap of 3 lists, so the last by position is frozen. */
async function userWithFrozenList() {
    const u = await signedInUser()
    const rows = await db.insert(exerciseLists)
        .values([0, 1, 2, 3].map((position) => ({ userId: u.id, authorId: u.id, name: `List ${position}`, position })))
        .returning()
    return { ...u, lists: rows.sort((a, b) => a.position - b.position) }
}

describe('list create and rename', () => {
    it('trims the name and stores a blank description as null', async () => {
        const { token } = await signedInUser()
        const res = await post(token, LISTS, { name: '  Leg day  ', description: '   ' })
        expect(res.status).toBe(201)
        expect(await res.json()).toMatchObject({ name: 'Leg day', description: null, items: [], frozen: false })
    })

    it('refuses a blank or too long name', async () => {
        const { token } = await signedInUser()
        expect((await post(token, LISTS, { name: '   ' })).status).toBe(400)
        expect((await post(token, LISTS, { name: 'x'.repeat(121) })).status).toBe(400)
        expect((await post(token, LISTS, { name: 'Ok', description: 'x'.repeat(501) })).status).toBe(400)
    })

    it('answers 409 for a name the user already has, after trimming', async () => {
        const { token } = await signedInUser()
        await createList(token, 'Push')
        const res = await post(token, LISTS, { name: ' Push ' })
        expect(res.status).toBe(409)
        expect((await res.json()).error).toBe('exercise_list_name_taken')
    })

    it('renames with the full list shape, and keeps an omitted description', async () => {
        const { token } = await signedInUser()
        const list = (await (await post(token, LISTS, { name: 'Pull', description: 'Back' })).json())
        await send(token, 'POST', `${LISTS}/${list.id}/items`, { exerciseId: (await exercise()).id })

        const res = await send(token, 'PATCH', `${LISTS}/${list.id}`, { name: ' Pull day ' })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toMatchObject({ id: list.id, name: 'Pull day', description: 'Back', frozen: false })
        expect(body.items).toHaveLength(1)

        expect(await (await send(token, 'PATCH', `${LISTS}/${list.id}`, { description: ' ' })).json())
            .toMatchObject({ description: null })
    })

    it('no longer takes a position: the order goes through /reorder', async () => {
        const { token } = await signedInUser()
        const list = await createList(token, 'A')
        expect((await send(token, 'PATCH', `${LISTS}/${list.id}`, { position: 3 })).status).toBe(400)
    })

    it("answers 404 for another user's list and a malformed id", async () => {
        const { token } = await signedInUser()
        const other = await signedInUser()
        const list = await createList(other.token, 'Theirs')
        expect((await send(token, 'PATCH', `${LISTS}/${list.id}`, { name: 'Mine' })).status).toBe(404)
        expect((await get(token, `${LISTS}/${list.id}`)).status).toBe(404)
        expect((await get(token, `${LISTS}/abc`)).status).toBe(400)
    })

    it('refuses to rename a frozen list', async () => {
        const { token, lists } = await userWithFrozenList()
        const res = await send(token, 'PATCH', `${LISTS}/${lists[3].id}`, { name: 'Thawed' })
        expect(res.status).toBe(403)
        expect(await res.json()).toMatchObject({ error: 'exercise_list_frozen', listId: lists[3].id })
    })
})

describe('list reorder', () => {
    it('stores the whole order at once', async () => {
        const { token } = await signedInUser()
        const a = await createList(token, 'A')
        const b = await createList(token, 'B')
        const c = await createList(token, 'C')

        const res = await send(token, 'PATCH', `${LISTS}/reorder`, { ids: [c.id, a.id, b.id] })
        expect(res.status).toBe(200)
        expect((await res.json()).map((l: { id: number }) => l.id)).toEqual([c.id, a.id, b.id])
        expect((await (await get(token, LISTS)).json()).map((l: { id: number; position: number }) => [l.id, l.position]))
            .toEqual([[c.id, 0], [a.id, 1], [b.id, 2]])
    })

    it('must name each of the lists exactly once', async () => {
        const { token } = await signedInUser()
        const a = await createList(token, 'A')
        const b = await createList(token, 'B')
        const other = await createList((await signedInUser()).token, 'Theirs')

        for (const ids of [[a.id], [a.id, a.id], [a.id, b.id, other.id], [a.id, other.id]]) {
            const res = await send(token, 'PATCH', `${LISTS}/reorder`, { ids })
            expect(res.status).toBe(400)
            expect((await res.json()).error).toBe('exercise_list_order_mismatch')
        }
    })

    it('keeps frozen lists at the end', async () => {
        const { token, lists } = await userWithFrozenList()
        const [l0, l1, l2, frozen] = lists.map((l) => l.id)

        expect((await send(token, 'PATCH', `${LISTS}/reorder`, { ids: [l2, l0, l1, frozen] })).status).toBe(200)
        const res = await send(token, 'PATCH', `${LISTS}/reorder`, { ids: [frozen, l0, l1, l2] })
        expect(res.status).toBe(403)
        expect(await res.json()).toMatchObject({ error: 'exercise_list_frozen', listIds: [frozen] })
    })
})

describe('list items', () => {
    const itemsPath = (id: number) => `${LISTS}/${id}/items`

    it('stores prescriptions trimmed, with blank notes as null', async () => {
        const { token } = await signedInUser()
        const list = await createList(token, 'Strength')
        const bench = await exercise()

        const res = await send(token, 'PUT', itemsPath(list.id), {
            items: [
                { exerciseId: bench.id, position: 0, targetSets: 3, targetReps: 5, targetWeight: 82.5, restSeconds: 0, notes: '  Pause  ' },
                { exerciseId: bench.id, position: 1, targetDuration: 60, targetDistance: 1.5, notes: '   ' },
            ],
        })
        expect(res.status).toBe(200)
        const { items } = await res.json()
        expect(items[0]).toMatchObject({ targetSets: 3, targetReps: 5, targetWeight: 82.5, restSeconds: 0, notes: 'Pause', targetDuration: null })
        expect(items[1]).toMatchObject({ targetDuration: 60, targetDistance: 1.5, notes: null, targetSets: null })
    })

    it('reorders existing items, keeping their ids and targets', async () => {
        const { token } = await signedInUser()
        const list = await createList(token, 'Swap')
        const a = await exercise()
        const b = await exercise()
        const first = await (await send(token, 'PUT', itemsPath(list.id), {
            items: [{ exerciseId: a.id, position: 0, targetSets: 4 }, { exerciseId: b.id, position: 1 }],
        })).json()
        const [itemA, itemB] = first.items

        const res = await send(token, 'PUT', itemsPath(list.id), {
            items: [{ id: itemB.id, exerciseId: b.id, position: 0 }, { id: itemA.id, exerciseId: a.id, position: 1, targetSets: 4 }],
        })
        expect(res.status).toBe(200)
        expect((await res.json()).items.map((i: { id: number; position: number; targetSets: number | null }) => [i.id, i.position, i.targetSets]))
            .toEqual([[itemB.id, 0, null], [itemA.id, 1, 4]])
    })

    it('refuses targets out of bounds', async () => {
        const { token } = await signedInUser()
        const list = await createList(token, 'Bounds')
        const { id: exerciseId } = await exercise()

        for (const target of [
            { targetSets: 0 }, { targetSets: 51 }, { targetReps: 0 }, { targetReps: 1.5 }, { targetWeight: 0 },
            { targetWeight: 1001 }, { targetDuration: 0 }, { targetDuration: 86_401 }, { targetDistance: -1 },
            { restSeconds: -1 }, { restSeconds: 3601 }, { notes: 'x'.repeat(501) }, { unknown: 1 },
        ]) {
            const res = await send(token, 'PUT', itemsPath(list.id), { items: [{ exerciseId, position: 0, ...target }] })
            expect(res.status, JSON.stringify(target)).toBe(400)
        }
    })

    it('refuses more than 100 items, and repeated item ids', async () => {
        const { token } = await signedInUser()
        const list = await createList(token, 'Long')
        const { id: exerciseId } = await exercise()
        const many = Array.from({ length: 101 }, (_, position) => ({ exerciseId, position }))
        expect((await send(token, 'PUT', itemsPath(list.id), { items: many })).status).toBe(400)

        const { items } = await (await send(token, 'PUT', itemsPath(list.id), { items: [{ exerciseId, position: 0 }] })).json()
        const res = await send(token, 'PUT', itemsPath(list.id), {
            items: [{ id: items[0].id, exerciseId, position: 0 }, { id: items[0].id, exerciseId, position: 1 }],
        })
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('exercise_list_item_not_found')
    })

    it("refuses another user's exercise and keeps the items", async () => {
        const { token } = await signedInUser()
        const other = await signedInUser()
        const list = await createList(token, 'Mixed')
        const mine = await exercise()
        await send(token, 'PUT', itemsPath(list.id), { items: [{ exerciseId: mine.id, position: 0 }] })

        const theirs = await exercise('Theirs', other.id)
        const res = await send(token, 'PUT', itemsPath(list.id), { items: [{ exerciseId: theirs.id, position: 0 }] })
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('exercise_not_available')
        const rows = await db.select().from(exerciseListItems).where(eq(exerciseListItems.listId, list.id))
        expect(rows.map((r) => r.exerciseId)).toEqual([mine.id])
    })

    it('appends one exercise at the end, unprescribed', async () => {
        const { token } = await signedInUser()
        const list = await createList(token, 'Append')
        const a = await exercise()
        const b = await exercise()
        await send(token, 'PUT', itemsPath(list.id), { items: [{ exerciseId: a.id, position: 0, targetSets: 3 }] })

        const res = await post(token, itemsPath(list.id), { exerciseId: b.id })
        expect(res.status).toBe(201)
        const { listId, items } = await res.json()
        expect(listId).toBe(list.id)
        expect(items.map((i: { exerciseId: number; position: number }) => [i.exerciseId, i.position])).toEqual([[a.id, 0], [b.id, 1]])
        expect(items[0].targetSets).toBe(3)
        expect(items[1].targetSets).toBeNull()
    })

    it('appends concurrently without a position conflict', async () => {
        const { token } = await signedInUser()
        const list = await createList(token, 'Race')
        const ids = await Promise.all([1, 2, 3, 4].map(async () => (await exercise()).id))

        const results = await Promise.all(ids.map((exerciseId) => post(token, itemsPath(list.id), { exerciseId })))
        expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201])
        const rows = await db.select().from(exerciseListItems).where(eq(exerciseListItems.listId, list.id))
        expect(rows.map((r) => r.position).sort()).toEqual([0, 1, 2, 3])
    })

    it('refuses to append past 100 items, to a frozen list, or an unavailable exercise', async () => {
        const { token, lists } = await userWithFrozenList()
        const { id: exerciseId } = await exercise()

        const frozen = await post(token, itemsPath(lists[3].id), { exerciseId })
        expect(frozen.status).toBe(403)
        expect((await frozen.json()).error).toBe('exercise_list_frozen')

        const full = lists[0].id
        await db.insert(exerciseListItems).values(Array.from({ length: 100 }, (_, position) => ({ listId: full, exerciseId, position })))
        const res = await post(token, itemsPath(full), { exerciseId })
        expect(res.status).toBe(400)
        expect(await res.json()).toMatchObject({ error: 'exercise_list_full', maxItems: 100 })

        const other = await signedInUser()
        const theirs = await exercise('Not mine', other.id)
        expect((await post(token, itemsPath(lists[1].id), { exerciseId: theirs.id })).status).toBe(400)
        expect((await post(token, itemsPath(999_999), { exerciseId })).status).toBe(404)
    })
})

describe('list rules in the database', () => {
    it('refuses untrimmed names, blank descriptions and notes, and non-positive targets', async () => {
        const { id: userId } = await signedInUser()
        const insertList = (values: { name: string; description?: string }) =>
            db.insert(exerciseLists).values({ userId, position: 0, ...values })
        await expect(insertList({ name: ' Padded' })).rejects.toThrow()
        await expect(insertList({ name: 'Blank', description: '  ' })).rejects.toThrow()

        const [list] = await insertList({ name: 'Fine' }).returning()
        const { id: exerciseId } = await exercise()
        const insertItem = (values: object) => db.insert(exerciseListItems).values({ listId: list.id, exerciseId, position: 0, ...values })
        await expect(insertItem({ notes: ' ' })).rejects.toThrow()
        await expect(insertItem({ targetWeight: 0 })).rejects.toThrow()
        await expect(insertItem({ restSeconds: 3601 })).rejects.toThrow()
    })
})
