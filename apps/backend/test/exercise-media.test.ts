import { beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import db from '../src/db/db.js'
import { exerciseMedia, exercises, user } from '../src/db/schema/index.js'
import type { MediaStore, StoredFile } from '../src/lib/media-store.js'
import { app, bearer, post, signedInUser } from './helpers.js'

// The media store, in memory: a test "uploads" with `store.files.set`, as a browser would.
const store = vi.hoisted(() => {
    const files = new Map<string, StoredFile>()
    const deleted: string[] = []
    const fake: MediaStore & { files: typeof files; deleted: typeof deleted } = {
        files,
        deleted,
        uploadToken: async (key) => `token-for:${key}`,
        head: async (key) => files.get(key) ?? null,
        delete: async (keys) => {
            for (const key of keys) files.delete(key)
            deleted.push(...keys)
        },
    }
    return fake
})
vi.mock('../src/lib/media-store.js', () => ({ mediaStore: store }))

const MB = 1024 * 1024

const send = (token: string, method: string, path: string, body?: unknown) =>
    app.request(path, bearer(token, { method, ...(body !== undefined && { body: JSON.stringify(body) }) }))

async function admin() {
    const me = await signedInUser()
    await db.update(user).set({ role: 'admin' }).where(eq(user.id, me.id))
    return me
}

async function systemExercise() {
    const name = `System ${Math.random()}`
    const [row] = await db.insert(exercises).values({ name, nameI18n: { en: name } }).returning()
    return row
}

/** Gets a token, "uploads" a file under its key, and records it. */
async function addImage(token: string, exerciseId: number, file: Partial<StoredFile> = {}, body: object = {}) {
    const res = await post(token, `/admin/exercises/${exerciseId}/media/upload-token`, { contentType: 'image/webp' })
    expect(res.status).toBe(200)
    const { key } = await res.json()
    store.files.set(key, { url: `https://blob.test/${key}`, bytes: 1000, contentType: 'image/webp', ...file })
    return { key, res: await post(token, `/admin/exercises/${exerciseId}/media`, { key, width: 640, height: 480, animated: true, ...body }) }
}

const positions = async (exerciseId: number) =>
    (await db.select().from(exerciseMedia).where(eq(exerciseMedia.exerciseId, exerciseId)).orderBy(exerciseMedia.position))
        .map((m) => [m.uuid, m.position])

beforeEach(() => {
    store.files.clear()
    store.deleted.length = 0
})

describe('exercise media', () => {
    it('is admin only', async () => {
        const { token } = await signedInUser()
        const exercise = await systemExercise()
        expect((await post(token, `/admin/exercises/${exercise.id}/media/upload-token`, { contentType: 'image/webp' })).status).toBe(403)
    })

    it('signs an upload under the exercise, records it from what the store reports, and lists it', async () => {
        const { token } = await admin()
        const exercise = await systemExercise()
        const tokenRes = await (await post(token, `/admin/exercises/${exercise.id}/media/upload-token`, { contentType: 'image/png' })).json()
        expect(tokenRes.key).toMatch(new RegExp(`^exercises/${exercise.uuid}/[0-9a-f-]{36}\\.png$`))
        expect(tokenRes.token).toBe(`token-for:${tokenRes.key}`)

        const { res } = await addImage(token, exercise.id, { bytes: 1234 }, { alt: { en: ' Bottom position ', es: '  ' } })
        expect(res.status).toBe(201)
        const created = await res.json()
        expect(created).toMatchObject({ mimeType: 'image/webp', bytes: 1234, position: 0, animated: true, width: 640, height: 480, altI18n: { en: 'Bottom position' } })

        const me = await signedInUser()
        const rows: Array<Record<string, any>> = await (await app.request('/api/exercise-info/exercises', bearer(me.token))).json()
        expect(rows.find((e) => e.id === exercise.id)!.media).toEqual([
            { uuid: created.uuid, url: created.url, animated: true, width: 640, height: 480, alt: 'Bottom position' },
        ])
        const adminRows: Array<Record<string, any>> = await (await app.request('/admin/exercises', bearer(token))).json()
        expect(adminRows.find((e) => e.id === exercise.id)!.media).toEqual([created])
    })

    it('only on system exercises', async () => {
        const { token, id } = await admin()
        const [own] = await db.insert(exercises).values({ name: 'Mine', userId: id }).returning()
        expect((await post(token, `/admin/exercises/${own.id}/media/upload-token`, { contentType: 'image/webp' })).status).toBe(404)
    })

    it('re-checks the type and size with the store, deleting a file that breaks them', async () => {
        const { token } = await admin()
        const exercise = await systemExercise()
        expect((await post(token, `/admin/exercises/${exercise.id}/media/upload-token`, { contentType: 'image/gif' })).status).toBe(400)

        const tooBig = await addImage(token, exercise.id, { bytes: 2 * MB + 1 })
        expect(tooBig.res.status).toBe(400)
        const wrongType = await addImage(token, exercise.id, { contentType: 'image/svg+xml' })
        expect(wrongType.res.status).toBe(400)
        expect(store.deleted).toEqual([tooBig.key, wrongType.key])
        expect(await positions(exercise.id)).toEqual([])

        const exactly2MB = await addImage(token, exercise.id, { bytes: 2 * MB })
        expect(exactly2MB.res.status).toBe(201)
    })

    it('refuses keys outside the exercise, nothing uploaded, and recording twice', async () => {
        const { token } = await admin()
        const exercise = await systemExercise()
        const other = await systemExercise()
        const record = (key: string) => post(token, `/admin/exercises/${exercise.id}/media`, { key, width: 1, height: 1, animated: false })

        const { key: othersKey } = await addImage(token, other.id)
        expect((await record(othersKey)).status).toBe(400)
        expect((await record(`exercises/${exercise.uuid}/never-uploaded.webp`)).status).toBe(400)

        const { key } = await addImage(token, exercise.id)
        expect((await record(key)).status).toBe(409)
        expect(store.files.has(key)).toBe(true)
        expect(await positions(exercise.id)).toHaveLength(1)
    })

    it('holds at most 6 per exercise', async () => {
        const { token } = await admin()
        const exercise = await systemExercise()
        for (let i = 0; i < 6; i++) expect((await addImage(token, exercise.id)).res.status).toBe(201)
        expect((await post(token, `/admin/exercises/${exercise.id}/media/upload-token`, { contentType: 'image/webp' })).status).toBe(409)
        expect((await positions(exercise.id)).map(([, p]) => p)).toEqual([0, 1, 2, 3, 4, 5])
    })

    it('holds the limit when a full exercise gets a file uploaded with an earlier token', async () => {
        const { token } = await admin()
        const exercise = await systemExercise()
        const { key } = await (await post(token, `/admin/exercises/${exercise.id}/media/upload-token`, { contentType: 'image/webp' })).json()
        for (let i = 0; i < 6; i++) await addImage(token, exercise.id)
        store.files.set(key, { url: `https://blob.test/${key}`, bytes: 10, contentType: 'image/webp' })
        expect((await post(token, `/admin/exercises/${exercise.id}/media`, { key, width: 1, height: 1, animated: false })).status).toBe(409)
        expect(store.deleted).toEqual([key])
    })

    it('reorders by uuid, refusing anything but a permutation', async () => {
        const { token } = await admin()
        const exercise = await systemExercise()
        const uuids: string[] = []
        for (let i = 0; i < 3; i++) uuids.push((await (await addImage(token, exercise.id)).res.json()).uuid)
        const order = (list: string[]) => send(token, 'PATCH', `/admin/exercises/${exercise.id}/media/order`, { uuids: list })

        const res = await order([uuids[2], uuids[0], uuids[1]])
        expect(res.status).toBe(200)
        expect((await res.json()).map((m: { uuid: string }) => m.uuid)).toEqual([uuids[2], uuids[0], uuids[1]])
        expect(await positions(exercise.id)).toEqual([[uuids[2], 0], [uuids[0], 1], [uuids[1], 2]])

        expect((await order([uuids[0], uuids[1]])).status).toBe(400)
        expect((await order([uuids[0], uuids[0], uuids[1]])).status).toBe(400)
        expect((await order([uuids[0], uuids[1], crypto.randomUUID()])).status).toBe(400)
    })

    it('updates and clears the alt text', async () => {
        const { token } = await admin()
        const exercise = await systemExercise()
        const { uuid } = await (await addImage(token, exercise.id)).res.json()
        const patch = (alt: unknown) => send(token, 'PATCH', `/admin/exercises/${exercise.id}/media/${uuid}`, { alt })
        expect(await (await patch({ en: 'Top', es: 'Arriba' })).json()).toMatchObject({ altI18n: { en: 'Top', es: 'Arriba' } })
        expect(await (await patch({ en: ' ' })).json()).toMatchObject({ altI18n: null })
        expect((await patch({ en: 'x'.repeat(201) })).status).toBe(400)
    })

    it('deletes the file with the row and closes the gap', async () => {
        const { token } = await admin()
        const exercise = await systemExercise()
        const added = []
        for (let i = 0; i < 3; i++) {
            const { key, res } = await addImage(token, exercise.id)
            added.push({ key, uuid: (await res.json()).uuid })
        }
        expect((await send(token, 'DELETE', `/admin/exercises/${exercise.id}/media/${added[0].uuid}`)).status).toBe(200)
        expect(store.deleted).toEqual([added[0].key])
        expect(await positions(exercise.id)).toEqual([[added[1].uuid, 0], [added[2].uuid, 1]])
        expect((await send(token, 'DELETE', `/admin/exercises/${exercise.id}/media/${added[0].uuid}`)).status).toBe(404)

        // The next one goes last again.
        expect((await (await addImage(token, exercise.id)).res.json()).position).toBe(2)
    })

    it('deletes the files when the exercise is deleted', async () => {
        const { token } = await admin()
        const exercise = await systemExercise()
        const keys = [(await addImage(token, exercise.id)).key, (await addImage(token, exercise.id)).key]
        expect((await send(token, 'DELETE', `/admin/exercises/${exercise.id}`)).status).toBe(200)
        expect(store.deleted.sort()).toEqual(keys.sort())
        expect(await db.select().from(exerciseMedia)).toEqual([])
    })
})
