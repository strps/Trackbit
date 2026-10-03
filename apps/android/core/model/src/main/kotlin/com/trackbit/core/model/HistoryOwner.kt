package com.trackbit.core.model

/** What asks for tracker history beyond the recent week. Each owner keeps and releases its own request. */
enum class HistoryOwner {
    /** The heatmap widgets, while any is placed. */
    Heatmap,

    /** The tracker screen, while it shows a day other than today. */
    Tracker,

    /** The analytics screen: every habit's logs back to the first, for stats and heatmaps. */
    Analytics,
}
