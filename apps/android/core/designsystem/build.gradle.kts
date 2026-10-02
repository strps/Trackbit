plugins {
    alias(libs.plugins.trackbit.android.library)
    alias(libs.plugins.trackbit.android.compose)
}

android {
    namespace = "com.trackbit.core.designsystem"
}

dependencies {
    api(projects.core.model)
    implementation(projects.core.i18n)
}
