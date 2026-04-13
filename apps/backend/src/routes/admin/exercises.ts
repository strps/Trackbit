import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAdminAuth } from '../../middleware/require-admin-auth.js'
import db from '../../db/db.js'
import { exercises, exerciseMuscleGroups, muscleGroups } from '../../db/schema/index.js'
import { eq, inArray, sql } from 'drizzle-orm'

type AuthEnv = {
    Variables: {
        user: any
        session: any
    }
}

const app = new Hono<AuthEnv>()
app.use('*', requireAdminAuth)

const exerciseBodySchema = z.object({
    name: z.string().min(1, 'Name is required').trim(),
    category: z.enum(['strength', 'cardio', 'flexibility']),
    description: z.string().max(500).optional().nullable(),
    defaultWeightUnit: z.enum(['kg', 'lbs']).optional().nullable(),
    defaultDistanceUnit: z.enum(['km', 'miles']).optional().nullable(),
    muscleGroups: z.array(z.number().int().positive()).optional(),
})

// List all exercises with their muscle groups
app.get('/', async (c) => {
    const allExercises = await db
        .select({
            id: exercises.id,
            name: exercises.name,
            category: exercises.category,
            description: exercises.description,
            defaultWeightUnit: exercises.defaultWeightUnit,
            defaultDistanceUnit: exercises.defaultDistanceUnit,
            userId: exercises.userId,
            createdAt: exercises.createdAt,
        })
        .from(exercises)
        .orderBy(exercises.name)

    // Fetch muscle group associations for all exercises
    const exerciseIds = allExercises.map((e) => e.id)
    const mgLinks =
        exerciseIds.length > 0
            ? await db
                .select({
                    exerciseId: exerciseMuscleGroups.exerciseId,
                    muscleGroupId: muscleGroups.id,
                    muscleGroupName: muscleGroups.name,
                })
                .from(exerciseMuscleGroups)
                .innerJoin(muscleGroups, eq(exerciseMuscleGroups.muscleGroupId, muscleGroups.id))
                .where(inArray(exerciseMuscleGroups.exerciseId, exerciseIds))
            : []

    const mgByExercise = mgLinks.reduce<Record<number, { id: number; name: string }[]>>((acc, row) => {
        if (!acc[row.exerciseId]) acc[row.exerciseId] = []
        acc[row.exerciseId].push({ id: row.muscleGroupId, name: row.muscleGroupName })
        return acc
    }, {})

    return c.json(
        allExercises.map((e) => ({
            ...e,
            muscleGroups: mgByExercise[e.id] ?? [],
        }))
    )
})

// Create a system exercise (userId = null)
app.post('/', zValidator('json', exerciseBodySchema), async (c) => {
    const { muscleGroups: mgIds, ...data } = c.req.valid('json')

    const [created] = await db
        .insert(exercises)
        .values({ ...data, userId: null })
        .returning()

    if (mgIds && mgIds.length > 0) {
        await db.insert(exerciseMuscleGroups).values(
            mgIds.map((mgId) => ({
                exerciseId: created.id,
                muscleGroupId: mgId,
                role: 'primary' as const,
            }))
        )
    }

    return c.json(created, 201)
})

// Update any exercise
app.patch('/:id', zValidator('json', exerciseBodySchema.partial()), async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

    const { muscleGroups: mgIds, ...data } = c.req.valid('json')

    const [updated] = await db
        .update(exercises)
        .set(data)
        .where(eq(exercises.id, id))
        .returning()

    if (!updated) return c.json({ error: 'Exercise not found' }, 404)

    if (mgIds !== undefined) {
        await db.delete(exerciseMuscleGroups).where(eq(exerciseMuscleGroups.exerciseId, id))
        if (mgIds.length > 0) {
            await db.insert(exerciseMuscleGroups).values(
                mgIds.map((mgId) => ({
                    exerciseId: id,
                    muscleGroupId: mgId,
                    role: 'primary' as const,
                }))
            )
        }
    }

    return c.json(updated)
})

// Delete any exercise
app.delete('/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

    const [deleted] = await db.delete(exercises).where(eq(exercises.id, id)).returning()
    if (!deleted) return c.json({ error: 'Exercise not found' }, 404)

    return c.json({ success: true })
})

// ─── Muscle Group Routes ───────────────────────────────────────────────────────

const muscleGroupBodySchema = z.object({
    name: z.string().min(1, 'Name is required').trim(),
    slug: z.string().optional(),
    description: z.string().optional().nullable(),
    parentId: z.number().int().positive().optional().nullable(),
    displayOrder: z.number().int().optional(),
})

const toSlug = (name: string) =>
    name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// List all muscle groups with parent name
app.get('/muscle-groups', async (c) => {
    const rows = await db.execute(sql`
        SELECT
            mg.id,
            mg.name,
            mg.slug,
            mg.description,
            mg.parent_id   AS "parentId",
            p.name         AS "parentName",
            mg.level,
            mg.display_order AS "displayOrder",
            mg.created_at  AS "createdAt"
        FROM muscle_groups mg
        LEFT JOIN muscle_groups p ON mg.parent_id = p.id
        ORDER BY mg.display_order, mg.name
    `)

    return c.json(rows.rows)
})

// Create a muscle group
app.post('/muscle-groups', zValidator('json', muscleGroupBodySchema), async (c) => {
    const body = c.req.valid('json')
    const slug = body.slug ?? toSlug(body.name)

    const level = body.parentId ? 2 : 1

    const rows = (await db
        .insert(muscleGroups)
        .values({ ...body, slug, level })
        .returning()) as unknown as any[]
    const created = rows[0]

    return c.json(created, 201)
})

// Update a muscle group
app.patch('/muscle-groups/:id', zValidator('json', muscleGroupBodySchema.partial()), async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

    const body = c.req.valid('json')
    const updates: Record<string, unknown> = { ...body }
    if (body.name && !body.slug) updates.slug = toSlug(body.name)

    const updatedRows = (await db
        .update(muscleGroups)
        .set(updates)
        .where(eq(muscleGroups.id, id))
        .returning()) as unknown as any[]
    const updated = updatedRows[0]

    if (!updated) return c.json({ error: 'Muscle group not found' }, 404)

    return c.json(updated)
})

// Delete a muscle group
app.delete('/muscle-groups/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10)
    if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

    const deletedRows = (await db.delete(muscleGroups).where(eq(muscleGroups.id, id)).returning()) as unknown as any[]
    if (!deletedRows[0]) return c.json({ error: 'Muscle group not found' }, 404)

    return c.json({ success: true })
})

export default app
