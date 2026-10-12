package com.trackbit.core.model

// Variants are one level deep (a base and its variants), so a family needs no graph walk. The same
// rules as the web's `exercise-family.ts`.

/**
 * The exercises in [exercise]'s family other than itself: its base (when it's a variant) and every
 * variant of that base, base first, the rest in [catalog]'s order.
 */
fun exerciseFamily(exercise: Exercise, catalog: List<Exercise>): List<Exercise> {
    val baseUuid = exercise.variantOfUuid ?: exercise.uuid
    val base = catalog.find { it.uuid == baseUuid }
    val variants = catalog.filter { it.variantOfUuid == baseUuid }
    return (listOfNotNull(base) + variants).filter { it.uuid != exercise.uuid }
}

/**
 * The exercises [exercise] (null for a new one) may become a variant of: bases other than itself,
 * and none at all when it has variants of its own, since a base can't become a variant. The server
 * enforces the same rules (and that the base is visible); this only keeps the form from offering
 * what it would refuse.
 */
fun variantOfCandidates(exercise: Exercise?, catalog: List<Exercise>): List<Exercise> {
    if (exercise != null && catalog.any { it.variantOfUuid == exercise.uuid }) return emptyList()
    return catalog.filter { it.variantOfUuid == null && it.uuid != exercise?.uuid }
}
