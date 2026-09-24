import type { ColorStop } from './index.js';

// Single source for how habits look, shared by the backend, the web app and the
// Android generator (apps/android/scripts). UI labels live in each client's i18n.

export const COLOR_THEMES = ['green', 'blue', 'orange', 'purple', 'rose', 'fire', 'custom'] as const;
export type ColorTheme = (typeof COLOR_THEMES)[number];

/** Heatmap gradient for each preset theme; `custom` doubles as the default custom gradient. */
export const GRADIENT_PRESET_STOPS: Record<ColorTheme, ColorStop[]> = {
    green: [
        { position: 0, color: [241, 245, 249, 0.1] },   // slate-100
        { position: 0.4, color: [134, 239, 172, 0.4] }, // green-300
        { position: 1, color: [21, 128, 61, 1] },       // green-700
    ],
    blue: [
        { position: 0, color: [241, 245, 249, 0.1] },   // slate-100
        { position: 0.4, color: [147, 197, 253, 0.4] }, // blue-300
        { position: 1, color: [29, 78, 216, 1] },       // blue-700
    ],
    orange: [
        { position: 0, color: [241, 245, 249, 0.1] },   // slate-100
        { position: 0.4, color: [253, 186, 116, 0.4] }, // orange-300
        { position: 1, color: [194, 65, 12, 1] },       // orange-700
    ],
    purple: [
        { position: 0, color: [241, 245, 249, 0.1] },   // slate-100
        { position: 0.4, color: [216, 180, 254, 0.4] }, // purple-300
        { position: 1, color: [126, 34, 206, 1] },      // purple-700
    ],
    rose: [
        { position: 0, color: [241, 245, 249, 0.1] },   // slate-100
        { position: 0.4, color: [253, 164, 175, 0.4] }, // rose-300
        { position: 1, color: [190, 18, 60, 1] },       // rose-700
    ],
    fire: [
        { position: 0, color: [255, 237, 213, 0.1] },   // orange-100
        { position: 0.5, color: [249, 115, 22, 0.5] },  // orange-500
        { position: 1, color: [185, 28, 28, 1] },       // red-700
    ],
    custom: [
        { position: 0, color: [255, 0, 0, 1] },
        { position: 0.5, color: [255, 225, 0, 1] },
        { position: 1, color: [12, 148, 62, 1] },
    ],
};

/** The stops a habit actually renders with: its own for `custom`, otherwise the preset's. */
export function resolveColorStops(habit: { colorTheme: ColorTheme; colorStops: ColorStop[] }): ColorStop[] {
    return habit.colorTheme === 'custom' ? habit.colorStops : GRADIENT_PRESET_STOPS[habit.colorTheme];
}

/** Habit icon ids a client may store in `habits.icon`. */
export const HABIT_ICON_IDS = [
    'book', 'dumbbell', 'code', 'water', 'sun',
    'moon', 'music', 'work', 'coffee', 'ban',
    'alert', 'home', 'star', 'heart', 'trees',
] as const;
export type HabitIconId = (typeof HABIT_ICON_IDS)[number];
