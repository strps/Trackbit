import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import db from '../src/db/db.js'
import { dayLogs, exerciseLogs, exercisePerformances, exercises, exerciseSessions, user } from '../src/db/schema/index.js'
import { app, bearer, createHabit, post, signedInUser } from './helpers.js'

const EXERCISES = '/api/exercise-info/exercises'

const send = (token: string, method: string, path: string, body?: unknown) =>
    app.request(path, bearer(token, { method, ...(body !== undefined && { body: JSON.stringify(body) }) }))

async function listed(token: string, id: number) {
    const rows: Array<Record<string, any>> = await (await app.request(EXERCISES, bearer(token))).json()
    return rows.find((row) => row.id === id)!
}

async function systemExercise(values: Partial<typeof exercises.$inferInsert> = {}) {
    const name = `System ${Math.random()}`
    const [row] = await db.insert(exercises).values({ name, nameI18n: { en: name }, ...values }).returning()
    return row
}

async function admin() {
    const me = await signedInUser()
    await db.update(user).set({ role: 'admin' }).where(eq(user.id, me.id))
    return me
}

describe('exercise info fields', () => {
    it('trims the lists, drops blank entries, and stores none left as null', async () => {
        const { token } = await signedInUser()
        const res = await post(token, EXERCISES, {
            name: 'Dips', category: 'strength',
            instructions: ['  Grip the bars ', '', '  ', 'Lower slowly'],
            tips: ['   '],
            equipment: ['bodyweight', 'other', 'bodyweight'],
            difficulty: 'intermediate',
        })
        expect(res.status).toBe(201)
        const created = await res.json()
        expect(created).toMatchObject({
            instructions: ['Grip the bars', 'Lower slowly'],
            tips: null,
            commonMistakes: null,
            equipment: ['bodyweight', 'other'],
            difficulty: 'intermediate',
            variantOfId: null,
            variantOfUuid: null,
            recentLogs: [],
        })
        expect(await listed(token, created.id)).toEqual(created)

        // Omitted leaves a list as it is; null or only blanks clear it.
        const patched = await (await send(token, 'PATCH', `${EXERCISES}/${created.id}`, { tips: ['Elbows in'] })).json()
        expect(patched).toMatchObject({ instructions: ['Grip the bars', 'Lower slowly'], tips: ['Elbows in'] })
        const cleared = await (await send(token, 'PATCH', `${EXERCISES}/${created.id}`, { instructions: [' '], tips: null, difficulty: null })).json()
        expect(cleared).toMatchObject({ instructions: null, tips: null, difficulty: null, equipment: ['bodyweight', 'other'] })
    })

    it('defaults to no equipment and no difficulty', async () => {
        const { token } = await signedInUser()
        const created = await (await post(token, EXERCISES, { name: 'Plank', category: 'flexibility' })).json()
        expect(created).toMatchObject({ instructions: null, equipment: [], difficulty: null })
    })

    it('validates the limits and vocabularies', async () => {
        const { token } = await signedInUser()
        const create = (body: object) => post(token, EXERCISES, { name: `Squat ${Math.random()}`, category: 'strength', ...body })

        expect((await create({ instructions: Array(21).fill('Step') })).status).toBe(400)
        expect((await create({ tips: ['x'.repeat(301)] })).status).toBe(400)
        expect((await create({ commonMistakes: [1] })).status).toBe(400)
        expect((await create({ equipment: ['trampoline'] })).status).toBe(400)
        expect((await create({ difficulty: 'expert' })).status).toBe(400)
        expect((await create({ instructions: Array(20).fill('x'.repeat(300)) })).status).toBe(201)
    })

    it('localizes system exercise lists, falling back to English', async () => {
        const me = await signedInUser()
        const exercise = await systemExercise({
            instructionsI18n: { en: ['Brace'], es: ['Aprieta el core'] },
            tipsI18n: { en: ['Breathe'] },
        })
        await db.update(user).set({ locale: 'es' }).where(eq(user.id, me.id))
        expect(await listed(me.token, exercise.id)).toMatchObject({ instructions: ['Aprieta el core'], tips: ['Breathe'], commonMistakes: null })
    })

    it('is never empty or blank in the database', async () => {
        await expect(systemExercise({ instructions: [] })).rejects.toThrow()
        await expect(systemExercise({ tips: ['ok', '  '] })).rejects.toThrow()
        await expect(systemExercise({ commonMistakes: 'text' as any })).rejects.toThrow()
        await expect(systemExercise({ instructionsI18n: {} })).rejects.toThrow()
        await expect(systemExercise({ tipsI18n: { en: [] } })).rejects.toThrow()
        await expect(systemExercise({ commonMistakesI18n: { en: ['ok'], es: [' '] } })).rejects.toThrow()
        await expect(systemExercise({ instructions: ['ok'], tipsI18n: { en: ['ok'], es: ['bien'] } })).resolves.toBeDefined()
    })

    it('admin translations drop blank entries and empty locales', async () => {
        const { token } = await admin()
        const res = await post(token, '/admin/exercises', {
            name: { en: `Row ${Math.random()}` }, category: 'strength',
            instructions: { en: [' Pull ', ''], es: ['  '] },
            equipment: ['cable'], difficulty: 'beginner',
        })
        expect(res.status).toBe(201)
        const { id } = await res.json()
        const stored = async () => (await db.select().from(exercises).where(eq(exercises.id, id)))[0]
        expect(await stored()).toMatchObject({ instructionsI18n: { en: ['Pull'] }, tipsI18n: null, equipment: ['cable'], difficulty: 'beginner' })

        expect((await send(token, 'PATCH', `/admin/exercises/${id}`, { instructions: { en: [] }, tips: { es: ['Despacio'] } })).status).toBe(200)
        expect(await stored()).toMatchObject({ instructionsI18n: null, tipsI18n: { es: ['Despacio'] } })

        const listedRow = (await (await app.request('/admin/exercises', bearer(token))).json()).find((e: { id: number }) => e.id === id)
        expect(listedRow).toMatchObject({ instructionsI18n: null, tipsI18n: { es: ['Despacio'] }, equipment: ['cable'], difficulty: 'beginner', variantOfId: null })
    })
})

describe('exercise variants', () => {
    it('links a custom exercise to a system base by id or uuid, and clears it with null', async () => {
        const { token } = await signedInUser()
        const bench = await systemExercise()

        const byId = await (await post(token, EXERCISES, { name: 'Smith bench', category: 'strength', variantOfId: bench.id })).json()
        expect(byId).toMatchObject({ variantOfId: bench.id, variantOfUuid: bench.uuid })

        const byUuid = await post(token, EXERCISES, { name: 'Floor press', category: 'strength', variantOfUuid: bench.uuid })
        expect(await byUuid.json()).toMatchObject({ variantOfId: bench.id })

        const cleared = await (await send(token, 'PATCH', `${EXERCISES}/uuid/${byId.uuid}`, { variantOfUuid: null })).json()
        expect(cleared).toMatchObject({ variantOfId: null, variantOfUuid: null })

        expect((await post(token, EXERCISES, { name: 'Both', category: 'strength', variantOfId: bench.id, variantOfUuid: bench.uuid })).status).toBe(400)
    })

    it('links to one of the user\'s own exercises, never to another user\'s', async () => {
        const me = await signedInUser()
        const other = await signedInUser()
        const mine = await (await post(me.token, EXERCISES, { name: 'Base', category: 'strength' })).json()
        const theirs = await (await post(other.token, EXERCISES, { name: 'Theirs', category: 'strength' })).json()

        expect((await post(me.token, EXERCISES, { name: 'Variant', category: 'strength', variantOfId: mine.id })).status).toBe(201)
        for (const ref of [{ variantOfId: theirs.id }, { variantOfUuid: theirs.uuid }, { variantOfId: 999_999 }]) {
            const res = await post(me.token, EXERCISES, { name: `Sneaky ${Math.random()}`, category: 'strength', ...ref })
            expect(res.status).toBe(400)
            expect((await res.json()).error).toBe('invalid_variant_of')
        }
    })

    it('keeps families one level deep', async () => {
        const { token } = await signedInUser()
        const base = await (await post(token, EXERCISES, { name: 'Base', category: 'strength' })).json()
        const variant = await (await post(token, EXERCISES, { name: 'Variant', category: 'strength', variantOfId: base.id })).json()
        const other = await (await post(token, EXERCISES, { name: 'Other', category: 'strength' })).json()

        // Not a variant of a variant, a base can't become a variant, and nothing is its own variant.
        for (const [id, body] of [
            [other.id, { variantOfId: variant.id }],
            [base.id, { variantOfId: other.id }],
            [base.id, { variantOfId: base.id }],
        ] as const) {
            const res = await send(token, 'PATCH', `${EXERCISES}/${id}`, body)
            expect(res.status).toBe(400)
            expect((await res.json()).error).toBe('invalid_variant_of')
        }
    })

    it('holds in the database for any writer', async () => {
        const me = await signedInUser()
        const other = await signedInUser()
        const base = await systemExercise()
        const variant = await systemExercise({ variantOfId: base.id })
        const [theirs] = await db.insert(exercises).values({ name: 'Theirs', userId: other.id }).returning()
        const [mine] = await db.insert(exercises).values({ name: 'Mine', userId: me.id }).returning()

        await expect(systemExercise({ variantOfId: variant.id })).rejects.toThrow()
        await expect(systemExercise({ variantOfId: mine.id })).rejects.toThrow()
        await expect(db.insert(exercises).values({ name: 'Sneaky', userId: me.id, variantOfId: theirs.id })).rejects.toThrow()
        await expect(db.update(exercises).set({ variantOfId: (await systemExercise()).id }).where(eq(exercises.id, base.id))).rejects.toThrow()
        await expect(db.update(exercises).set({ variantOfId: mine.id }).where(eq(exercises.id, mine.id))).rejects.toThrow()
        await expect(db.insert(exercises).values({ name: 'Fine', userId: me.id, variantOfId: base.id })).resolves.toBeDefined()
    })

    it('outlives its base: deleting the base leaves the variant a base', async () => {
        const { token } = await signedInUser()
        const base = await (await post(token, EXERCISES, { name: 'Base', category: 'strength' })).json()
        const variant = await (await post(token, EXERCISES, { name: 'Variant', category: 'strength', variantOfId: base.id })).json()
        expect((await send(token, 'DELETE', `${EXERCISES}/${base.id}`)).status).toBe(200)
        expect(await listed(token, variant.id)).toMatchObject({ variantOfId: null, variantOfUuid: null })
    })

    it('admin links system exercises only to system bases', async () => {
        const { token } = await admin()
        const other = await signedInUser()
        const base = await systemExercise()
        const [theirs] = await db.insert(exercises).values({ name: 'Theirs', userId: other.id }).returning()

        const create = (variantOfId: number) => post(token, '/admin/exercises', { name: { en: `V ${Math.random()}` }, category: 'strength', variantOfId })
        const ok = await create(base.id)
        expect(ok.status).toBe(201)
        expect((await ok.json()).variantOfId).toBe(base.id)
        expect((await create(theirs.id)).status).toBe(400)
        expect((await create(999_999)).status).toBe(400)
        expect((await send(token, 'PATCH', `/admin/exercises/${base.id}`, { variantOfId: base.id })).status).toBe(400)
    })
})

describe('exercise recentLogs', () => {
    /** A log of [exerciseId] on [localDay] with [sets], in a new session of a new habit. */
    async function logOn(me: { id: string; token: string }, exerciseId: number, localDay: string, sets: Array<{ reps: number; weight: number }>) {
        const habit = await createHabit(me.id, { type: 'complex' })
        const [dayLog] = await db.insert(dayLogs).values({ habitId: habit.id, localDay }).returning()
        const [session] = await db.insert(exerciseSessions).values({ dayLogId: dayLog.id }).returning()
        const [log] = await db.insert(exerciseLogs).values({ exerciseId, exerciseSessionId: session.id }).returning()
        // Inserted out of order: the answer orders them by number.
        for (const [i, set] of [...sets.entries()].reverse()) {
            await db.insert(exercisePerformances).values({ exerciseLogId: log.id, number: i + 1, rpe: 7, ...set })
        }
        return log
    }

    it("are the user's two latest logs with sets, newest first, sets in order", async () => {
        const me = await signedInUser()
        const other = await signedInUser()
        const exercise = await systemExercise()

        await logOn(me, exercise.id, '2026-10-01', [{ reps: 5, weight: 80 }])
        const middle = await logOn(me, exercise.id, '2026-10-05', [{ reps: 5, weight: 85 }, { reps: 4, weight: 85 }])
        const latest = await logOn(me, exercise.id, '2026-10-09', [{ reps: 6, weight: 82.5 }])
        await logOn(me, exercise.id, '2026-10-10', []) // no sets: skipped
        await logOn(other, exercise.id, '2026-10-11', [{ reps: 1, weight: 200 }]) // someone else's

        expect((await listed(me.token, exercise.id)).recentLogs).toEqual([
            { uuid: latest.uuid, localDay: '2026-10-09', sets: [{ reps: 6, weight: 82.5, duration: null, distance: null, rpe: 7 }] },
            {
                uuid: middle.uuid, localDay: '2026-10-05', sets: [
                    { reps: 5, weight: 85, duration: null, distance: null, rpe: 7 },
                    { reps: 4, weight: 85, duration: null, distance: null, rpe: 7 },
                ],
            },
        ])
    })
})

describe('variant rules SQL', () => {
    it('is in the migrations verbatim, as the test database applies it', () => {
        const rules = readFileSync(new URL('../src/db/sql/exercise-variant-rules.sql', import.meta.url), 'utf8')
        const migration = readFileSync(new URL('../drizzle/0018_exercise_info.sql', import.meta.url), 'utf8')
        expect(migration).toContain(rules.trim())
    })
})
