package com.trackbit.core.model

import com.trackbit.core.model.ExerciseListRules.Problem
import com.trackbit.core.model.ExerciseListRules.Target
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class ExerciseListRulesTest {
    @Test fun `names are trimmed, 1 to 120`() {
        assertEquals(setOf(Problem.NameLength), ExerciseListRules.problems("   ", null))
        assertEquals(emptySet<Problem>(), ExerciseListRules.problems("  ${"x".repeat(120)}  ", " "))
        assertEquals(setOf(Problem.NameLength), ExerciseListRules.problems("x".repeat(121), null))
        assertEquals(setOf(Problem.DescriptionLength), ExerciseListRules.problems("Legs", "x".repeat(501)))
        assertThrows(IllegalArgumentException::class.java) { ExerciseListRequest(" ", null) }
    }

    @Test fun `targets are positive and bounded, rest may be zero`() {
        fun problems(p: Prescription) = ExerciseListRules.problems(p)
        val none = Prescription.NONE
        assertEquals(emptySet<Target>(), problems(none))
        assertEquals(
            emptySet<Target>(),
            problems(Prescription(50, 1000, 1000.0, 86_400, 1000.0, 0, "x".repeat(500))),
        )
        assertEquals(
            Target.entries.toSet(),
            problems(Prescription(0, 0, 0.0, 0, 0.0, -1, "x".repeat(501))),
        )
        assertEquals(
            setOf(Target.Sets, Target.Reps, Target.Weight, Target.Duration, Target.Distance, Target.Rest),
            problems(Prescription(51, 1001, 1000.5, 86_401, 1000.1, 3601, null)),
        )
    }

    @Test fun `a request refuses an invalid prescription and too many items`() {
        assertThrows(IllegalArgumentException::class.java) {
            ExerciseListItemsRequest.of(listOf(ListItemDraft("item", "exercise", Prescription.NONE.copy(targetReps = 0))))
        }
        assertThrows(IllegalArgumentException::class.java) {
            ExerciseListItemsRequest.of(List(101) { ListItemDraft("item-$it", "exercise", Prescription.NONE) })
        }
    }
}
