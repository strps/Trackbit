plugins {
    alias(libs.plugins.trackbit.android.feature)
}

android {
    namespace = "com.trackbit.feature.auth"
}

dependencies {
    implementation(projects.core.auth)
}
