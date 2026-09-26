plugins {
    alias(libs.plugins.trackbit.android.feature)
}

android {
    namespace = "com.trackbit.feature.tracker"
}

dependencies {
    implementation(projects.core.data)
    implementation(libs.androidx.core.ktx)
}
