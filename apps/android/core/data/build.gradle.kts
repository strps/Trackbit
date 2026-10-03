plugins {
    alias(libs.plugins.trackbit.android.library)
    alias(libs.plugins.trackbit.hilt)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.trackbit.core.data"
}

dependencies {
    api(projects.core.model)
    implementation(projects.core.auth)
    implementation(projects.core.database)
    implementation(projects.core.network)
    implementation(libs.androidx.core.ktx)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.androidx.work.runtime)
    implementation(libs.androidx.hilt.work)
    ksp(libs.androidx.hilt.compiler)

    testImplementation(libs.androidx.test.core)
    testImplementation(libs.androidx.work.testing)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.robolectric)
}
