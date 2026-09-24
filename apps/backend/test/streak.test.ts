import { describe, expect, it } from 'vitest'
import { streakEndingAt, type StreakDay } from '../src/lib/streak.js'

const logs = (entries: Record<string, Partial<StreakDay>>) =>
    new Map(Object.entries(entries).map(([d, v]) => [d, { rating: null, sessionCount: 0, ...v }]))

const regular = { type: 'count', isAntiHabit: false }
const complex = { type: 'complex', isAntiHabit: false }
const anti = { type: 'count', isAntiHabit: true }

describe('streakEndingAt', () => {
    it('counts consecutive rated days and stops at a gap', () => {
        const l = logs({ '2026-01-10': { rating: 1 }, '2026-01-09': { rating: 3 }, '2026-01-07': { rating: 1 } })
        expect(streakEndingAt(regular, l, '2026-01-10', '2026-01-07')).toBe(2)
    })

    it('is 0 when the start day is not done', () => {
        const l = logs({ '2026-01-09': { rating: 1 } })
        expect(streakEndingAt(regular, l, '2026-01-10', '2026-01-09')).toBe(0)
    })

    it('treats rating 0 as not done', () => {
        expect(streakEndingAt(regular, logs({ '2026-01-10': { rating: 0 } }), '2026-01-10', '2026-01-10')).toBe(0)
    })

    it('uses sessions, not rating, for complex habits', () => {
        const l = logs({ '2026-01-10': { sessionCount: 1 }, '2026-01-09': { rating: 5 } })
        expect(streakEndingAt(complex, l, '2026-01-10', '2026-01-09')).toBe(1)
    })

    it('counts avoided days for anti-habits back to the first log', () => {
        const l = logs({ '2026-01-06': { rating: 0 }, '2026-01-08': { rating: 0 } })
        // 01-10, 01-09 (no log), 01-08 (0), 01-07 (no log), 01-06 (first log) → 5
        expect(streakEndingAt(anti, l, '2026-01-10', '2026-01-06')).toBe(5)
    })

    it('breaks an anti-habit streak on a slip', () => {
        const l = logs({ '2026-01-06': { rating: 0 }, '2026-01-08': { rating: 2 } })
        expect(streakEndingAt(anti, l, '2026-01-10', '2026-01-06')).toBe(2)
    })

    it('is 0 for an anti-habit that was never logged', () => {
        expect(streakEndingAt(anti, logs({}), '2026-01-10', null)).toBe(0)
    })

    it('caps at a year', () => {
        expect(streakEndingAt(anti, logs({}), '2026-01-10', '2020-01-01')).toBe(365)
    })
})
