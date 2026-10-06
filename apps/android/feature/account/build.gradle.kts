plugins {
    alias(libs.plugins.trackbit.android.feature)
}

android {
    namespace = "com.trackbit.feature.account"
}

dependencies {
    implementation(projects.core.auth)
    implementation(projects.core.data)
}
