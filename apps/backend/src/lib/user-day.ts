import { DateTime, IANAZone } from 'luxon'
import { z } from 'zod'

/** A calendar day as `YYYY-MM-DD`, rejecting impossible dates like 2026-02-30. */
export const localDaySchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
    .refine((v) => DateTime.fromISO(v).isValid, 'Invalid date')

/** IANA timezone name, e.g. `America/Costa_Rica`. */
export const timezoneSchema = z
    .string()
    .min(1)
    .refine((v) => IANAZone.isValidZone(v), 'Invalid IANA timezone')

/** "Today" for the user, in their stored timezone. The server owns this, not the client. */
export function todayFor(user: { timezone: string }): string {
    const today = DateTime.now().setZone(user.timezone).toISODate()
    if (!today) throw new Error(`User timezone "${user.timezone}" is not a valid IANA zone`)
    return today
}

/** The explicit day a client asked for, or the user's today. */
export function resolveDay(user: { timezone: string }, day?: string): string {
    return day ?? todayFor(user)
}

/** `day` shifted by `n` days (negative = earlier). */
export function addDays(day: string, n: number): string {
    return DateTime.fromISO(day).plus({ days: n }).toISODate()!
}
