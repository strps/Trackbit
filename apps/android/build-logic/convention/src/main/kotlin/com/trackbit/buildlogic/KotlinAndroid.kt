package com.trackbit.buildlogic

import com.android.build.api.dsl.CommonExtension
import org.gradle.api.JavaVersion
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.dependencies
import org.jetbrains.kotlin.gradle.dsl.KotlinBaseExtension

internal object TrackbitSdk {
    const val COMPILE = 37
    const val TARGET = 36
    const val MIN = 26
    const val JVM = 21
}

/** Settings shared by every Android module, application or library. */
internal fun Project.configureKotlinAndroid(android: CommonExtension) {
    android.apply {
        compileSdk = TrackbitSdk.COMPILE
        defaultConfig.minSdk = TrackbitSdk.MIN
        compileOptions.sourceCompatibility = JavaVersion.toVersion(TrackbitSdk.JVM)
        compileOptions.targetCompatibility = JavaVersion.toVersion(TrackbitSdk.JVM)
        lint.abortOnError = true
        // Robolectric sets up Android 16+ (API 36) through FileDescriptor internals that JDK 17+
        // only exposes on request.
        testOptions.unitTests.all { it.jvmArgs("--add-exports=java.base/jdk.internal.access=ALL-UNNAMED") }
    }
    configureKotlin()
    dependencies {
        add("testImplementation", libs.library("junit"))
    }
}

internal fun Project.configureKotlin() {
    extensions.configure<KotlinBaseExtension> {
        jvmToolchain(TrackbitSdk.JVM)
    }
}
