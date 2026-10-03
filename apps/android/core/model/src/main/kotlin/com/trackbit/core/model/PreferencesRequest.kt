package com.trackbit.core.model

import kotlinx.serialization.Serializable

/**
 * `PATCH /api/me/preferences`. Null fields are left out of the body and stay unchanged; at least
 * one must be set. `preferredExerciseSource` has its own body, [PreferredExerciseSourceRequest].
 */
@Serializable
data class PreferencesRequest(
    /** `en` or `es`. */
    val locale: String? = null,
    /** An IANA zone. */
    val timezone: String? = null,
    val unitSystem: UnitSystem? = null,
    val exerciseLogCardStyle: ExerciseLogCardStyle? = null,
    /** In [SessionUser.REST_SECONDS_RANGE]; 0 turns the rest timer off. */
    val defaultRestSeconds: Int? = null,
) {
    init {
        require(
            locale != null || timezone != null || unitSystem != null || exerciseLogCardStyle != null ||
                defaultRestSeconds != null,
        ) { "At least one preference must be set" }
        require(defaultRestSeconds == null || defaultRestSeconds in SessionUser.REST_SECONDS_RANGE) {
            "defaultRestSeconds out of range: $defaultRestSeconds"
        }
    }
}

/**
 * `PATCH /api/me/preferences` with only `preferredExerciseSource`. Always encoded, `null` included:
 * null is browse mode (no source), which [PreferencesRequest]'s "null means absent" can't say.
 */
@Serializable
data class PreferredExerciseSourceRequest(
    /** A source key such as `list:12`, or null for browse mode. */
    val preferredExerciseSource: String?,
)
