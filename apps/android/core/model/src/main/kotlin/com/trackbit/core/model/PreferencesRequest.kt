package com.trackbit.core.model

import kotlinx.serialization.Serializable

/**
 * `PATCH /api/me/preferences`. Null fields are left out of the body and stay unchanged; at least
 * one must be set.
 *
 * `preferredExerciseSource` is not here yet: clearing it needs an explicit `null` on the wire,
 * which this "null means absent" shape can't express. Add it with a tri-state type in Phase 3.
 */
@Serializable
data class PreferencesRequest(
    /** `en` or `es`. */
    val locale: String? = null,
    /** An IANA zone. */
    val timezone: String? = null,
    val unitSystem: UnitSystem? = null,
    val exerciseLogCardStyle: ExerciseLogCardStyle? = null,
) {
    init {
        require(locale != null || timezone != null || unitSystem != null || exerciseLogCardStyle != null) {
            "At least one preference must be set"
        }
    }
}
