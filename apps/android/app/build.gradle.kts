import com.android.build.api.variant.BuildConfigField

plugins {
    alias(libs.plugins.trackbit.android.application)
    alias(libs.plugins.trackbit.android.compose)
    alias(libs.plugins.trackbit.hilt)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.trackbit.app"

    defaultConfig {
        applicationId = "com.trackbit.app"
        versionCode = 1
        versionName = "0.1.0"
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        debug {
            // The emulator's alias for the host machine, where `pnpm dev:backend` listens.
            buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:3000/\"")
        }
    }
}

// Release builds take the backend URL from `-PTRACKBIT_API_URL=…` or the TRACKBIT_API_URL env var.
// Only release tasks check for it, so debug builds and CI never need it.
val releaseApiUrl = providers.gradleProperty("TRACKBIT_API_URL")
    .orElse(providers.environmentVariable("TRACKBIT_API_URL"))

val checkReleaseApiUrl = tasks.register("checkReleaseApiUrl") {
    val url = releaseApiUrl
    doLast {
        if (!url.isPresent) {
            throw GradleException("Release builds need TRACKBIT_API_URL (Gradle property or env var).")
        }
    }
}

tasks.named { it == "generateReleaseBuildConfig" }.configureEach {
    dependsOn(checkReleaseApiUrl)
}

androidComponents {
    onVariants(selector().withBuildType("release")) { variant ->
        variant.buildConfigFields?.put(
            "API_BASE_URL",
            releaseApiUrl.orElse("").map { BuildConfigField("String", "\"$it\"", "Backend base URL") },
        )
    }
}

dependencies {
    implementation(projects.core.data)
    implementation(projects.core.auth)
    implementation(projects.core.designsystem)
    implementation(projects.core.i18n)
    implementation(projects.core.network)
    implementation(projects.feature.auth)
    implementation(projects.widget)

    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.navigation.compose)
}
