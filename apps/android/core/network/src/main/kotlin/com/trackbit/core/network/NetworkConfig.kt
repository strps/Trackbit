package com.trackbit.core.network

/** Provided by `app`, which knows the build's backend URL. */
data class NetworkConfig(
    /** Ends with `/`; service paths are relative to it. */
    val baseUrl: String,
)
