plugins {
    alias(libs.plugins.trackbit.android.feature)
}

android {
    namespace = "com.trackbit.feature.exerciselists"
}

dependencies {
    implementation(projects.core.auth)
    implementation(projects.core.data)
    implementation(libs.reorderable)
}
