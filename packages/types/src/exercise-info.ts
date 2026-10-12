// Single source for what an exercise's info may hold, shared by the backend (Postgres enums and
// Zod rules), the web app, the admin and the Android generator. UI labels live in each client's i18n.

export const EXERCISE_EQUIPMENT = [
    'barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'bodyweight', 'band', 'bench', 'pull_up_bar', 'other',
] as const;
export type ExerciseEquipment = (typeof EXERCISE_EQUIPMENT)[number];

export const EXERCISE_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
export type ExerciseDifficulty = (typeof EXERCISE_DIFFICULTIES)[number];

/** Instructions, tips and common mistakes are each an ordered list of short entries. */
export const STEP_LIST_MAX_ENTRIES = 20;
export const STEP_LIST_ENTRY_MAX_LENGTH = 300;
