plugins {
    alias(libs.plugins.trackbit.android.library)
    alias(libs.plugins.trackbit.hilt)
}

android {
    namespace = "com.trackbit.core.network"
}

dependencies {
    api(projects.core.model)
}
