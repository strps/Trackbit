import type { Exercise } from '@trackbit/types';

type FamilyMember = Pick<Exercise, 'id' | 'variantOfId'>;

/**
 * The exercises in [exercise]'s family other than itself: its base (when it's a variant) and every
 * variant of that base, base first. Variants are one level deep, so a base's variants are all of it.
 */
export function getExerciseFamily<T extends FamilyMember>(exercise: T, catalog: readonly T[]): T[] {
    const baseId = exercise.variantOfId ?? exercise.id;
    const base = catalog.find((e) => e.id === baseId);
    const variants = catalog.filter((e) => e.variantOfId === baseId);
    return [...(base ? [base] : []), ...variants].filter((e) => e.id !== exercise.id);
}

/**
 * The exercises [exercise] may become a variant of: bases (not variants themselves) other than
 * itself, and none at all when it has variants of its own, since a base can't become a variant.
 * The server enforces the same rules; this only keeps the form from offering what it would refuse.
 */
export function variantOfCandidates<T extends FamilyMember>(exercise: T | undefined, catalog: readonly T[]): T[] {
    if (exercise && catalog.some((e) => e.variantOfId === exercise.id)) return [];
    return catalog.filter((e) => e.variantOfId === null && e.id !== exercise?.id);
}
