package com.trackbit.core.network

import java.util.UUID

/**
 * The `Idempotency-Key` of a tracker write. Generate it once, when the write is queued, and
 * reuse it on every retry: the server replays the first success instead of applying it twice.
 *
 * Services take it as a Retrofit `@Tag`, and [interceptor.IdempotencyKeyInterceptor] turns it
 * into the header. A plain class, not a value class, because Retrofit keys tags by Java type.
 */
data class IdempotencyKey(val value: String) {
    init {
        require(value.isNotEmpty() && value.length <= MAX_LENGTH) { "An Idempotency-Key is 1–$MAX_LENGTH characters" }
    }

    companion object {
        const val HEADER = "Idempotency-Key"
        const val MAX_LENGTH = 255

        fun random(): IdempotencyKey = IdempotencyKey(UUID.randomUUID().toString())
    }
}
