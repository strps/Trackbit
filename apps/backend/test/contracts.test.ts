import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { auth } from '../src/lib/auth.js'
import db from '../src/db/db.js'
import { exercises, idempotencyKeys, user } from '../src/db/schema/index.js'
import { app, bearer, createHabit, post, signInBearer, signedInUser } from './helpers.js'

// Records the real responses the Android app decodes, as
// `{ request, status, body }` files next to the Kotlin tests that decode them:
// success bodies in core:model (DTOs), error bodies in core:network (ApiError).
// A changed response fails here until the contracts are re-recorded with
// `pnpm --filter backend test:contracts:update`; the diff then shows up in review
// and the Android CI decodes the new files. CI never writes them.

const MODEL = fileURLToPath(new URL('../../android/core/model/src/test/resources/contracts/', import.meta.url))
const NETWORK = fileURLToPath(new URL('../../android/core/network/src/test/resources/contracts/', import.meta.url))

const recorded = { [MODEL]: new Set<string>(), [NETWORK]: new Set<string>() }

type Secrets = Record<string, string>

/** A signed-in user plus the per-run strings (ids, tokens) to hide from the contracts. */
async function contractUser(email: string, options: { role?: string } = {}) {
    const u = await signedInUser({ email, timezone: 'America/Costa_Rica' })
    if (options.role) await db.update(user).set({ role: options.role }).where(eq(user.id, u.id))
    const session = await (await app.request('/api/auth/get-session', bearer(u.token))).json()
    const secrets: Secrets = {
        [u.token]: 'bearer-token',
        [session.session.token]: 'session-token',
        [session.session.id]: 'session-id',
        [u.id]: 'user-id',
    }
    return { ...u, secrets }
}

// Every timestamp becomes the same instant, keeping its exact shape (separator,
// fraction digits, zone), so a format change still shows up in the diff.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}([T ])\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}(:?\d{2})?)?$/

function normalize(value: unknown, secrets: Secrets): unknown {
    if (typeof value === 'string') {
        const match = TIMESTAMP.exec(value)
        if (match) {
            const [, separator, fraction = '', zone = ''] = match
            return `2026-01-01${separator}00:00:00${fraction.replace(/\d/g, '0')}${zone}`
        }
        // Longest first: the bearer token contains the session token.
        return Object.keys(secrets)
            .sort((a, b) => b.length - a.length)
            .reduce((s, secret) => s.split(secret).join(secrets[secret]), value)
    }
    if (Array.isArray(value)) return value.map((v) => normalize(v, secrets))
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v, secrets)]))
    }
    return value
}

async function record(dir: string, name: string, request: string, res: Response, secrets: Secrets = {}) {
    const text = await res.text()
    const contract = { request, status: res.status, body: normalize(text ? JSON.parse(text) : null, secrets) }
    recorded[dir].add(name)
    await expect(JSON.stringify(contract, null, 2) + '\n').toMatchFileSnapshot(dir + name)
}

const get = (token: string, path: string) => app.request(path, bearer(token))
const send = (token: string, method: string, path: string, body: unknown) =>
    app.request(path, bearer(token, { method, body: JSON.stringify(body) }))

const CUSTOM_STOPS = [
    { position: 0, color: [255, 0, 0, 1] },
    { position: 0.5, color: [255, 225, 0, 0.5] },
    { position: 1, color: [12, 148, 62, 1] },
]

/** One habit per shape the app renders: preset and custom colors, anti, complex, and a frozen timed one. */
async function seedHabits(u: Awaited<ReturnType<typeof contractUser>>) {
    const create = (body: object) => post(u.token, '/api/habits', body)
    const read = await create({
        name: 'Read', description: 'Ten pages', type: 'count', dailyGoal: 3, weeklyGoal: 5,
        colorTheme: 'custom', colorStops: CUSTOM_STOPS, icon: 'book',
    })
    const sugar = await (await create({ name: 'No sugar', type: 'count', isAntiHabit: true, colorTheme: 'rose', icon: 'ban' })).json()
    const gym = await (await create({ name: 'Gym', type: 'complex', colorTheme: 'blue', icon: 'dumbbell' })).json()
    // The default role can't create a timed habit, so it is inserted and comes back frozen.
    const meditate = await createHabit(u.id, { name: 'Meditate', type: 'timed', dailyGoal: 20, order: 10, colorTheme: 'green', icon: 'moon' })
    return { read, sugar, gym, meditate }
}

describe('Android contracts', () => {
    it('habits', async () => {
        const u = await contractUser('habits@test.local')
        const { read } = await seedHabits(u)
        await record(MODEL, 'habit-created.json', 'POST /api/habits', read, u.secrets)
        await record(MODEL, 'habits.json', 'GET /api/habits', await get(u.token, '/api/habits'), u.secrets)
    })

    it('tracker', async () => {
        const u = await contractUser('tracker@test.local')
        const { read, sugar, gym, meditate } = await seedHabits(u)
        const readId = (await read.json()).id
        for (const [day, rating] of [['2026-01-07', 1], ['2026-01-08', 3], ['2026-01-09', 4]] as const) {
            await post(u.token, '/api/tracker/check', { habitId: readId, rating, day })
        }
        await post(u.token, '/api/tracker/check', { habitId: sugar.id, rating: 0, day: '2026-01-08' })
        const gymLog = await (await post(u.token, '/api/tracker/day-logs/ensure', { habitId: gym.id, day: '2026-01-09' })).json()
        await post(u.token, '/api/tracker/exercise-sessions', { dayLogId: gymLog.id })

        await record(MODEL, 'day-log.json', 'POST /api/tracker/check/increment',
            await post(u.token, '/api/tracker/check/increment', { habitId: readId, delta: 2, day: '2026-01-10' }, { 'idempotency-key': 'k-1' }),
            u.secrets)
        await record(MODEL, 'today.json', 'GET /api/tracker/today?day=2026-01-10',
            await get(u.token, '/api/tracker/today?day=2026-01-10'), u.secrets)
        await record(MODEL, 'days.json', 'GET /api/tracker/days?start=2026-01-01&end=2026-01-10',
            await get(u.token, '/api/tracker/days?start=2026-01-01&end=2026-01-10'), u.secrets)

        await record(NETWORK, 'habit-frozen.json', 'POST /api/tracker/check',
            await post(u.token, '/api/tracker/check', { habitId: meditate.id, rating: 60_000 }))
        await record(NETWORK, 'habit-not-found.json', 'POST /api/tracker/check',
            await post(u.token, '/api/tracker/check', { habitId: 999, rating: 1 }))
        await record(NETWORK, 'validation.json', 'POST /api/tracker/check/increment',
            await post(u.token, '/api/tracker/check/increment', { habitId: readId, delta: 1.5, day: '10/01/2026' }))
    })

    it('idempotency errors', async () => {
        const u = await contractUser('idempotency@test.local')
        const habit = await createHabit(u.id)
        const increment = (key: string) =>
            post(u.token, '/api/tracker/check/increment', { habitId: habit.id, delta: 1 }, { 'idempotency-key': key })

        await increment('used')
        await record(NETWORK, 'idempotency-key-reused.json', 'POST /api/tracker/check',
            await post(u.token, '/api/tracker/check', { habitId: habit.id, rating: 1 }, { 'idempotency-key': 'used' }))

        // A reservation without a stored response: the first request is still running.
        await db.insert(idempotencyKeys).values({ userId: u.id, key: 'running', method: 'POST', path: '/api/tracker/check/increment' })
        await record(NETWORK, 'idempotency-request-in-progress.json', 'POST /api/tracker/check/increment', await increment('running'))

        await record(NETWORK, 'idempotency-key-invalid.json', 'POST /api/tracker/check/increment', await increment('k'.repeat(256)))
    })

    it('exercises and sessions', async () => {
        const u = await contractUser('exercises@test.local')
        await db.insert(exercises).values({ name: 'Bench Press', nameI18n: { en: 'Bench Press', es: 'Press de banca' }, category: 'strength' })
        const row = await (await post(u.token, '/api/exercise-info/exercises', {
            name: 'My row', category: 'strength', defaultWeightUnit: 'lbs', defaultDistanceUnit: 'miles', muscleGroups: [],
        })).json()

        const list = await (await post(u.token, '/api/exercise-lists', { name: 'Pull day', description: 'Back and biceps' })).json()
        await send(u.token, 'PUT', `/api/exercise-lists/${list.id}/items`, {
            items: [{
                exerciseId: row.id, position: 0, targetSets: 3, targetReps: 8, targetWeight: 60.5,
                targetDuration: 90, targetDistance: 1.5, restSeconds: 120, notes: 'Pause at the top',
            }],
        })
        const lists = await get(u.token, '/api/exercise-lists')
        const [item] = (await lists.clone().json())[0].items
        await record(MODEL, 'exercise-lists.json', 'GET /api/exercise-lists', lists, u.secrets)

        // An empty list too: its descriptor has no prescriptions and its queue says why it's empty.
        const empty = await (await post(u.token, '/api/exercise-lists', { name: 'Legs' })).json()
        await record(MODEL, 'exercise-sources.json', 'GET /api/exercise-sources', await get(u.token, '/api/exercise-sources'), u.secrets)
        await record(MODEL, 'exercise-source.json', 'GET /api/exercise-sources/list::id',
            await get(u.token, `/api/exercise-sources/list:${list.id}`), u.secrets)
        await record(MODEL, 'exercise-source-empty.json', 'GET /api/exercise-sources/list::id',
            await get(u.token, `/api/exercise-sources/list:${empty.id}`), u.secrets)
        await record(NETWORK, 'exercise-source-not-found.json', 'GET /api/exercise-sources/list::id',
            await get(u.token, '/api/exercise-sources/list:999999'), u.secrets)

        const habit = await createHabit(u.id, { type: 'complex' })
        // Fixed client uuids, as the app sends them.
        const ids = {
            session: '00000000-0000-4000-8000-000000000001',
            log: '00000000-0000-4000-8000-000000000002',
            sets: ['00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004'],
        }
        const session = await post(u.token, '/api/tracker/exercise-sessions',
            { uuid: ids.session, habitId: habit.id, day: '2026-01-10' }, { 'idempotency-key': 's-1' })
        await record(MODEL, 'exercise-session.json', 'POST /api/tracker/exercise-sessions', session, u.secrets)

        const log = await post(u.token, '/api/tracker/exercise-logs', {
            uuid: ids.log, exerciseSessionUuid: ids.session, exerciseId: row.id, listItemId: item.id,
        })
        const logId = (await log.clone().json()).id
        await record(MODEL, 'exercise-log-created.json', 'POST /api/tracker/exercise-logs', log, u.secrets)
        await record(MODEL, 'exercise-log.json', 'PATCH /api/tracker/exercise-logs/:id',
            await send(u.token, 'PATCH', `/api/tracker/exercise-logs/${logId}`, { distance: 5.25, duration: 1500, distanceUnit: 'km', weightUnit: 'kg' }),
            u.secrets)
        await post(u.token, '/api/tracker/exercise-performances', { uuid: ids.sets[0], exerciseLogUuid: ids.log, number: 1, reps: 8, weight: 60.5 })
        await record(MODEL, 'exercise-performance.json', 'POST /api/tracker/exercise-performances',
            await post(u.token, '/api/tracker/exercise-performances', {
                uuid: ids.sets[1], exerciseLogUuid: ids.log, number: 2, reps: 6, weight: 62.5, duration: 45_000, distance: 1.25, rpe: 8,
            }),
            u.secrets)
        await record(MODEL, 'exercise-sessions.json', 'GET /api/tracker/exercise-sessions?habitId=:id&day=2026-01-10',
            await get(u.token, `/api/tracker/exercise-sessions?habitId=${habit.id}&day=2026-01-10`), u.secrets)

        await record(MODEL, 'exercises.json', 'GET /api/exercise-info/exercises', await get(u.token, '/api/exercise-info/exercises'), u.secrets)
    })

    it('frozen custom exercise', async () => {
        const u = await contractUser('frozen-exercise@test.local')
        // One over the default role's cap of 5, so one of them is frozen.
        const rows = await db.insert(exercises)
            .values(Array.from({ length: 6 }, (_, i) => ({ name: `Custom ${i}`, userId: u.id })))
            .returning()
        const habit = await createHabit(u.id, { type: 'complex' })
        const dayLog = await (await post(u.token, '/api/tracker/day-logs/ensure', { habitId: habit.id })).json()
        const session = await (await post(u.token, '/api/tracker/exercise-sessions', { dayLogId: dayLog.id })).json()
        const frozen = (await (await get(u.token, '/api/exercise-info/exercises')).json())
            .find((e: { frozen: boolean }) => e.frozen)
        expect(rows.map((r) => r.id)).toContain(frozen.id)

        await record(NETWORK, 'custom-exercise-frozen.json', 'POST /api/tracker/exercise-logs',
            await post(u.token, '/api/tracker/exercise-logs', { exerciseSessionId: session.id, exerciseId: frozen.id }))
    })

    it('session and preferences', async () => {
        const u = await contractUser('session@test.local')
        await post(u.token, '/api/exercise-lists', { name: 'Push day' })
        await send(u.token, 'PATCH', '/api/me/preferences', {
            locale: 'es', unitSystem: 'imperial', exerciseLogCardStyle: 'compact', preferredExerciseSource: 'list:1',
        })
        await record(MODEL, 'session.json', 'GET /api/auth/get-session', await get(u.token, '/api/auth/get-session'), u.secrets)
        await record(MODEL, 'limits.json', 'GET /api/me/limits', await get(u.token, '/api/me/limits'), u.secrets)

        const admin = await contractUser('admin@test.local', { role: 'admin' })
        await record(MODEL, 'limits-admin.json', 'GET /api/me/limits', await get(admin.token, '/api/me/limits'), admin.secrets)
    })

    it('auth errors', async () => {
        const u = await contractUser('auth@test.local')
        await record(NETWORK, 'sign-in-invalid-credentials.json', 'POST /api/auth/sign-in/email',
            (await signInBearer(u.email, 'wrong-password')).res)

        await auth.api.signUpEmail({ body: { email: 'unverified@test.local', password: 'password-1234', name: 'unverified' } })
        await record(NETWORK, 'sign-in-email-not-verified.json', 'POST /api/auth/sign-in/email',
            (await signInBearer('unverified@test.local', 'password-1234')).res)

        await app.request('/api/auth/sign-out', bearer(u.token, { method: 'POST' }))
        await record(NETWORK, 'get-session-signed-out.json', 'GET /api/auth/get-session', await get(u.token, '/api/auth/get-session'))
        await record(NETWORK, 'unauthorized.json', 'GET /api/tracker/today', await get(u.token, '/api/tracker/today'))
    })

    // Last, so it sees every contract above. A contract no test records any more must be deleted.
    it('leaves no stale contracts', () => {
        // New contracts are written after the run, so only files on disk that nothing records are checked.
        for (const [dir, names] of Object.entries(recorded)) {
            const onDisk = existsSync(dir) ? readdirSync(dir) : []
            expect(onDisk.filter((name) => !names.has(name))).toEqual([])
        }
    })
})
