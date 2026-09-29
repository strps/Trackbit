import com.android.build.api.dsl.LibraryExtension
import com.trackbit.buildlogic.TrackbitSdk
import com.trackbit.buildlogic.configureKotlinAndroid
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure

class AndroidLibraryConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            pluginManager.apply("com.android.library")
            extensions.configure<LibraryExtension> {
                configureKotlinAndroid(this)
                lint.targetSdk = TrackbitSdk.TARGET
                testOptions.targetSdk = TrackbitSdk.TARGET
                // Robolectric reads the SDK to run on from the merged manifest. Without it, it
                // falls back to its oldest SDK (API 23, below minSdk); with it, targetSdk.
                testOptions.unitTests.isIncludeAndroidResources = true
            }
        }
    }
}
