package com.trackbit.core.data

import java.util.UUID

/**
 * A new row's name. The app picks it when it creates a habit, exercise, list, list item, session,
 * log or set, and the server keeps it, so the row is the same before and after it syncs.
 */
fun newUuid(): String = UUID.randomUUID().toString()
