plugins {
    alias(libs.plugins.trackbit.android.library)
    alias(libs.plugins.trackbit.room)
    alias(libs.plugins.trackbit.hilt)
}

android {
    namespace = "com.trackbit.core.database"
}

dependencies {
    api(projects.core.model)
}
