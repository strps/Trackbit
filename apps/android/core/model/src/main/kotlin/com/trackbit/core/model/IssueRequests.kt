package com.trackbit.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** `issues.type`: what the user is sending. */
@Serializable
enum class IssueType {
    @SerialName("bug") Bug,
    @SerialName("feedback") Feedback,
}

/**
 * `POST /api/issues`: a bug report or feedback. The web sends its route as `path`; the app sends
 * no path and says what sent it in [client] instead ([IssueRules.client]).
 */
@Serializable
data class IssueRequest(
    val type: IssueType,
    val description: String,
    val client: String,
) {
    init {
        require(IssueRules.descriptionValid(description)) { "Invalid issue description length: ${description.trim().length}" }
        require(client.length <= IssueRules.CLIENT_MAX) { "Client too long: ${client.length}" }
    }
}

/** The report form's rules, the same the server enforces (`issues.ts`). */
object IssueRules {
    const val DESCRIPTION_MAX = 5000
    const val CLIENT_MAX = 255

    fun descriptionValid(description: String) = description.trim().length in 1..DESCRIPTION_MAX

    /**
     * What sent the report, e.g. `Trackbit Android 0.1.0 (1) · Google Pixel 8 · Android 16 (API 36)`.
     * The manufacturer is left out when the model already starts with it.
     */
    fun client(versionName: String, versionCode: Int, manufacturer: String, model: String, release: String, sdk: Int): String {
        val device = if (model.startsWith(manufacturer, ignoreCase = true)) model else "$manufacturer $model"
        return "Trackbit Android $versionName ($versionCode) · ${device.trim()} · Android $release (API $sdk)".take(CLIENT_MAX)
    }
}
