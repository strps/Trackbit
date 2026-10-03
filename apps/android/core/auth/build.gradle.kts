plugins {
    alias(libs.plugins.trackbit.android.library)
    alias(libs.plugins.trackbit.hilt)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.trackbit.core.auth"
}

dependencies {
    api(projects.core.model)
    api(projects.core.network)
    implementation(libs.androidx.datastore)
    implementation(libs.tink.android)
    implementation(libs.androidx.core.ktx)

    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.okhttp.mockwebserver)
}
