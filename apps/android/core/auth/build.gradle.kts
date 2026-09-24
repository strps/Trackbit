plugins {
    alias(libs.plugins.trackbit.android.library)
    alias(libs.plugins.trackbit.hilt)
}

android {
    namespace = "com.trackbit.core.auth"
}

dependencies {
    api(projects.core.model)
    implementation(projects.core.network)
}
