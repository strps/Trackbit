import { eq } from "drizzle-orm";
import db from "../db/db.js";
import { userLimits } from "../db/schema/app/settings.js";
import { habits } from "../db/schema/app/habits.js";
import { exercises } from "../db/schema/app/exercises.js";

export interface EffectiveLimits {
    maxHabits: number | null;
    maxCustomExercises: number | null;
    allowedHabitTypes: string[];
}

const DEFAULT_TESTER_LIMITS = {
    role: "tester",
    maxHabits: 10,
    maxCustomExercises: 5,
    allowedHabitTypes: ["count", "complex"],
};

// Conservative fallback used when no row matches a role.
// Mirrors the seeded tester baseline so unconfigured roles can't bypass caps.
const SECURE_DEFAULT_LIMITS: EffectiveLimits = {
    maxHabits: 10,
    maxCustomExercises: 5,
    allowedHabitTypes: ["count", "complex"],
};

export async function ensureDefaultUserLimits() {
    const rows = await db.select().from(userLimits);
    if (rows.length > 0) return rows;

    await db
        .insert(userLimits)
        .values(DEFAULT_TESTER_LIMITS)
        .onConflictDoNothing();

    return db.select().from(userLimits);
}

interface HabitForFreeze {
    id: number;
    type: string;
    order: number;
}

// Pure: given a user's habits and their limits, returns the set of frozen habit ids.
// Rules:
//  1. Any habit whose type is not in allowedHabitTypes is frozen unconditionally.
//  2. Among allowed-type habits, freeze starting from the highest `order` (= bottom of list)
//     until count is within maxHabits.
export function computeFrozenHabitIds(
    items: HabitForFreeze[],
    limits: EffectiveLimits | null
): Set<number> {
    const frozen = new Set<number>();
    if (!limits) return frozen;

    const allowedTypes = new Set(limits.allowedHabitTypes);
    const allowed: HabitForFreeze[] = [];

    for (const h of items) {
        if (!allowedTypes.has(h.type)) {
            frozen.add(h.id);
        } else {
            allowed.push(h);
        }
    }

    if (limits.maxHabits != null && allowed.length > limits.maxHabits) {
        const excess = allowed.length - limits.maxHabits;
        const sortedDesc = [...allowed].sort((a, b) => b.order - a.order);
        for (let i = 0; i < excess; i++) {
            frozen.add(sortedDesc[i].id);
        }
    }

    return frozen;
}

export async function computeFrozenHabitsForUser(
    userId: string,
    role: string | null | undefined
): Promise<Set<number>> {
    const limits = await getEffectiveLimits(role);
    if (!limits) return new Set();

    const rows = await db
        .select({ id: habits.id, type: habits.type, order: habits.order })
        .from(habits)
        .where(eq(habits.userId, userId));

    return computeFrozenHabitIds(rows, limits);
}

interface ExerciseForFreeze {
    id: number;
    createdAt: Date | string | null;
}

// Pure: freeze most-recent custom exercises (by createdAt desc) until count <= maxCustomExercises.
export function computeFrozenExerciseIds(
    items: ExerciseForFreeze[],
    limits: EffectiveLimits | null
): Set<number> {
    const frozen = new Set<number>();
    if (!limits || limits.maxCustomExercises == null) return frozen;

    if (items.length <= limits.maxCustomExercises) return frozen;

    const sortedDesc = [...items].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
    });

    const excess = items.length - limits.maxCustomExercises;
    for (let i = 0; i < excess; i++) {
        frozen.add(sortedDesc[i].id);
    }
    return frozen;
}

export async function computeFrozenExercisesForUser(
    userId: string,
    role: string | null | undefined
): Promise<Set<number>> {
    const limits = await getEffectiveLimits(role);
    if (!limits || limits.maxCustomExercises == null) return new Set();

    const rows = await db
        .select({ id: exercises.id, createdAt: exercises.createdAt })
        .from(exercises)
        .where(eq(exercises.userId, userId));

    return computeFrozenExerciseIds(rows, limits);
}

// Returns the limits to enforce for a given role.
// - admins: null (unlimited, skip enforcement)
// - role with a configured row: that row's values
// - any other role: SECURE_DEFAULT_LIMITS
export async function getEffectiveLimits(role: string | null | undefined): Promise<EffectiveLimits | null> {
    if (role === "admin") return null;

    if (role) {
        const [row] = await db
            .select()
            .from(userLimits)
            .where(eq(userLimits.role, role))
            .limit(1);

        if (row) {
            return {
                maxHabits: row.maxHabits ?? null,
                maxCustomExercises: row.maxCustomExercises ?? null,
                allowedHabitTypes: row.allowedHabitTypes ?? SECURE_DEFAULT_LIMITS.allowedHabitTypes,
            };
        }
    }

    return SECURE_DEFAULT_LIMITS;
}
