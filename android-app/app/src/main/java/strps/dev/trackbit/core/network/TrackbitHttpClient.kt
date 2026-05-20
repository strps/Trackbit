package strps.dev.trackbit.core.network

import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logging
import io.ktor.client.request.header
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

fun createTrackbitHttpClient(tokenManager: TokenManager): HttpClient {
    return HttpClient(OkHttp) {
        // Automatically handles JSON serialization/deserialization for your data models
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true // Prevents crashes if backend sends extra fields
                prettyPrint = true
                coerceInputValues = true
            })
        }

        // Global logging plugin to help you see network traffic in Logcat
        install(Logging) {
            level = LogLevel.BODY
        }

        // Apply base configurations to every outgoing request
        defaultRequest {
            // 10.0.2.2 is a special IP that redirects from the Android Emulator to your host's localhost
            url("http://10.0.2.2:3000/")
            contentType(ContentType.Application.Json)

            // Intercept outgoing requests and append the Bearer token dynamically if it exists
            tokenManager.getToken()?.let { token ->
                header("Authorization", "Bearer $token")
            }
        }
    }
}