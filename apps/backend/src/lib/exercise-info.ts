import { z } from 'zod'
import {
    EXERCISE_DIFFICULTIES,
    EXERCISE_EQUIPMENT,
    STEP_LIST_ENTRY_MAX_LENGTH,
    STEP_LIST_MAX_ENTRIES,
} from '@trackbit/types'
import { t } from '../i18n/index.js'

// The write rules for an exercise's info, shared by the user and admin routes. The schema's
// checks back them up; these keep a request from ever reaching them.

const entries = z.array(z.string().trim().max(STEP_LIST_ENTRY_MAX_LENGTH)).max(STEP_LIST_MAX_ENTRIES)

/** Without its blank entries: null when none is left. */
const kept = (list: string[] | null | undefined) => {
    const nonBlank = list?.filter(Boolean) ?? []
    return nonBlank.length > 0 ? nonBlank : null
}

/**
 * Instructions, tips or common mistakes: trimmed, blank entries dropped, and stored as null when
 * none is left. Nullable, not nullish, like `description`: omitted means unchanged.
 */
export const stepListSchema = entries.nullable().transform(kept)

/** The same per locale, for a system exercise: locales left empty are dropped, none at all is null. */
export const stepListI18nSchema = z.object({ en: entries.optional(), es: entries.optional() }).strict()
    .nullable()
    .transform((translations) => {
        const byLocale = Object.entries(translations ?? {}).flatMap(([locale, list]) => {
            const steps = kept(list)
            return steps ? [[locale, steps] as const] : []
        })
        return byLocale.length > 0 ? Object.fromEntries(byLocale) : null
    })

export const equipmentSchema = z.array(z.enum(EXERCISE_EQUIPMENT)).max(EXERCISE_EQUIPMENT.length)
    .transform((items) => [...new Set(items)])

export const difficultySchema = z.enum(EXERCISE_DIFFICULTIES).nullable()

/** The trigger in db/sql/exercise-variant-rules.sql refused a variant link, raised under this name. */
export const VARIANT_OF_RULES = 'exercises_variant_of_rules'

export const invalidVariantOfResponse = (locale: string) => ({
    error: 'invalid_variant_of',
    message: t('errors', 'invalid_variant_of', locale),
})
