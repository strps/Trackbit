package com.trackbit.core.network

import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import retrofit2.create

class FakeTokens(var token: String? = null) : SessionTokenSource {
    val rejected = mutableListOf<String>()
    override fun currentToken(): String? = token
    override fun onUnauthorized(rejectedToken: String) {
        rejected += rejectedToken
    }
}

/** A MockWebServer plus services wired exactly as in the app. */
class TestServer(
    val tokens: FakeTokens = FakeTokens(),
    language: RequestLanguage = RequestLanguage.Device,
) : AutoCloseable {
    val server = MockWebServer().apply { start() }
    val retrofit = trackbitRetrofit(server.url("/").toString(), trackbitOkHttpClient(tokens, language))

    inline fun <reified T : Any> service(): T = retrofit.create()

    fun enqueue(code: Int, body: String = "", vararg headers: Pair<String, String>) {
        val builder = MockResponse.Builder().code(code).body(body)
        if (body.isNotEmpty()) builder.addHeader("Content-Type", "application/json")
        headers.forEach { (name, value) -> builder.addHeader(name, value) }
        server.enqueue(builder.build())
    }

    fun takeRequest() = server.takeRequest()

    override fun close() = server.close()
}

val DAY_LOG_JSON = """
    {"id":7,"habitId":3,"rating":2,"notes":null,"localDay":"2026-09-26",
     "timeStamp":"2026-09-26T09:00:00.000Z","createdAt":"2026-09-26T09:00:00.000Z"}
""".trimIndent()
