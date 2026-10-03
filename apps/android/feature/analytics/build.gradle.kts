plugins {
    alias(libs.plugins.trackbit.android.feature)
}

android {
    namespace = "com.trackbit.feature.analytics"
}

dependencies {
    implementation(projects.core.auth)
    implementation(projects.core.data)
    implementation(libs.vico.compose.m3)
}
