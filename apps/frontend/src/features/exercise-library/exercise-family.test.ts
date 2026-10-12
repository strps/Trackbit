import { describe, expect, it } from 'vitest';
import { getExerciseFamily, variantOfCandidates } from './exercise-family';

const bench = { id: 1, variantOfId: null };
const incline = { id: 2, variantOfId: 1 };
const dumbbell = { id: 3, variantOfId: 1 };
const squat = { id: 4, variantOfId: null };
const catalog = [incline, squat, bench, dumbbell];

const ids = (list: { id: number }[]) => list.map((e) => e.id);

describe('getExerciseFamily', () => {
    it("lists a base's variants", () => {
        expect(ids(getExerciseFamily(bench, catalog))).toEqual([2, 3]);
    });

    it("lists a variant's base first, then its siblings", () => {
        expect(ids(getExerciseFamily(incline, catalog))).toEqual([1, 3]);
    });

    it('is empty for an exercise with no family', () => {
        expect(getExerciseFamily(squat, catalog)).toEqual([]);
    });

    it("keeps the siblings when the base isn't in the catalog", () => {
        expect(ids(getExerciseFamily(incline, [incline, dumbbell]))).toEqual([3]);
    });
});

describe('variantOfCandidates', () => {
    it('offers bases other than itself to a new exercise', () => {
        expect(ids(variantOfCandidates(undefined, catalog))).toEqual([4, 1]);
    });

    it('offers bases other than itself to a variant or a lone exercise', () => {
        expect(ids(variantOfCandidates(incline, catalog))).toEqual([4, 1]);
        expect(ids(variantOfCandidates(squat, catalog))).toEqual([1]);
    });

    it('offers nothing to a base with variants', () => {
        expect(variantOfCandidates(bench, catalog)).toEqual([]);
    });
});
