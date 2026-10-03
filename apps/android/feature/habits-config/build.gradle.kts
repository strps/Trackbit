plugins {
    alias(libs.plugins.trackbit.android.feature)
}

android {
    namespace = "com.trackbit.feature.habitsconfig"
}

dependencies {
    implementation(projects.core.data)
    implementation(libs.reorderable)
}
