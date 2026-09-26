import { HTTPException } from 'hono/http-exception'

// The one shape of a "frozen by role limits" 403: a stable `error` code plus the
// id of the frozen row, so clients can tell which item to mark read-only.

export function frozenHabitException(habitId: number) {
    return new HTTPException(403, {
        res: Response.json({
            error: 'habit_frozen',
            message: 'This habit is frozen because your role limits were reduced. Delete it or another to free a slot.',
            habitId,
        }, { status: 403 }),
    })
}

export function frozenExerciseException(exerciseId: number) {
    return new HTTPException(403, {
        res: Response.json({
            error: 'custom_exercise_frozen',
            message: 'This custom exercise is frozen because your role limits were reduced. Delete it or another to free a slot.',
            exerciseId,
        }, { status: 403 }),
    })
}
