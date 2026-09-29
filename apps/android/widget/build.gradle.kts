plugins {
    alias(libs.plugins.trackbit.android.widget)
}

android {
    namespace = "com.trackbit.widget"
}

dependencies {
    implementation(projects.core.data)
    implementation(projects.core.auth)
}
