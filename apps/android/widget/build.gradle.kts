plugins {
    alias(libs.plugins.trackbit.android.library)
    alias(libs.plugins.trackbit.android.compose)
    alias(libs.plugins.trackbit.hilt)
}

android {
    namespace = "com.trackbit.widget"
}

dependencies {
    implementation(projects.core.data)
    implementation(projects.core.designsystem)
    implementation(projects.core.i18n)
}
