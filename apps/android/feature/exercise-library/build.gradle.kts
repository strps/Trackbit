plugins {
    alias(libs.plugins.trackbit.android.feature)
}

android {
    namespace = "com.trackbit.feature.exerciselibrary"
}

dependencies {
    implementation(projects.core.data)
}
