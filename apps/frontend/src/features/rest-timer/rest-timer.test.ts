import { describe, expect, it } from 'vitest';
import { OVERTIME_MS, adjust, isExpired, isOver, remainingMs, restText, untilNextSecond } from './rest-timer';

const rest = { startedAt: 0, endsAt: 90_000, dayLogId: 1 };

describe('rest timer', () => {
    it('counts down, then into overtime, then expires', () => {
        expect(remainingMs(rest, 60_000)).toBe(30_000);
        expect(remainingMs(rest, 100_000)).toBe(-10_000);
        expect(isOver(rest, 89_999)).toBe(false);
        expect(isOver(rest, 90_000)).toBe(true);
        expect(isExpired(rest, 90_000 + OVERTIME_MS - 1)).toBe(false);
        expect(isExpired(rest, 90_000 + OVERTIME_MS)).toBe(true);
    });

    it('adjust moves the end, ends it when past, and does nothing in overtime', () => {
        expect(adjust(rest, 15_000, 0)?.endsAt).toBe(105_000);
        expect(adjust(rest, -15_000, 80_000)).toBeNull();
        expect(adjust(rest, 15_000, 95_000)).toBe(rest);
    });

    it('reads rounded up, then 0:00, then below zero', () => {
        expect(restText(90_000)).toBe('1:30');
        expect(restText(1)).toBe('0:01');
        expect(restText(0)).toBe('0:00');
        expect(restText(-999)).toBe('0:00');
        expect(restText(-1_000)).toBe('−0:01');
        expect(restText(-65_500)).toBe('−1:05');
        expect(restText(3_600_000)).toBe('1:00:00');
    });

    it('ticks at each shown second, below zero too', () => {
        expect(untilNextSecond(2_500)).toBe(500);
        expect(untilNextSecond(2_000)).toBe(1_000);
        expect(untilNextSecond(-300)).toBe(700);
        expect(untilNextSecond(0)).toBe(1_000);
    });
});
