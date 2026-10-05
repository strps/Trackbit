import { Hono } from "hono";
import { muscleGroups } from "../../../db/schema/index.js";
import db from "../../../db/db.js";
import { sql } from "drizzle-orm";

// The taxonomy is shared by every user and only admins edit it (`/admin/exercises/muscle-groups`),
// so the app only lists it.
const muscleGroupRouter = new Hono<{ Variables: { locale?: string } }>();

muscleGroupRouter.get('/', async (c) => {
    const locale = c.get('locale') ?? 'en'

    const rows = await db.select({
        id: muscleGroups.id,
        name: sql<string>`COALESCE(${muscleGroups.nameI18n}->>${locale}, ${muscleGroups.nameI18n}->>'en', ${muscleGroups.name})`.as('name'),
        slug: muscleGroups.slug,
        parentId: muscleGroups.parentId,
        level: muscleGroups.level,
        displayOrder: muscleGroups.displayOrder,
        createdAt: muscleGroups.createdAt,
    }).from(muscleGroups)

    return c.json(rows)
});

export default muscleGroupRouter;
