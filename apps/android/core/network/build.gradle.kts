plugins {
    alias(libs.plugins.trackbit.android.library)
    alias(libs.plugins.trackbit.hilt)
}

android {
    namespace = "com.trackbit.core.network"
}

dependencies {
    api(projects.core.model)
    api(libs.okhttp)
    api(libs.retrofit)
    api(libs.kotlinx.serialization.json)
    implementation(libs.retrofit.converter.kotlinx.serialization)

    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.okhttp.mockwebserver)
}
