package com.trackbit.core.model.serialization

import kotlinx.serialization.json.Json

/**
 * The one [Json] configuration for talking to the Trackbit API.
 *
 * - Unknown keys are ignored, so the backend can add fields without breaking old app builds.
 * - Properties equal to their default are not encoded, so an optional request field such as
 *   `day = null` is left out of the body rather than sent as `null`.
 */
val TrackbitJson: Json = Json {
    ignoreUnknownKeys = true
}
