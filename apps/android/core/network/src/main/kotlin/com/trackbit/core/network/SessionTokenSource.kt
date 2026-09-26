package com.trackbit.core.network

/** Where the bearer token comes from. `core:auth` implements it. */
interface SessionTokenSource {
    /**
     * The token to send, or null when signed out. Called on OkHttp's threads for every request,
     * so it must return from memory, not read storage.
     */
    fun currentToken(): String?

    /**
     * The server answered 401 to a request sent with [rejectedToken]. Sign out, unless the
     * current token has changed since (a newer sign-in must not be undone by a stale request).
     */
    fun onUnauthorized(rejectedToken: String)
}
