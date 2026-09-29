import com.trackbit.buildlogic.library
import com.trackbit.buildlogic.libs
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.dependencies

/**
 * The home-screen widget module: a Glance library with Hilt, the design system and strings,
 * tested with Robolectric and Glance's unit-test APIs.
 */
class AndroidWidgetConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            pluginManager.apply("trackbit.android.library")
            pluginManager.apply("trackbit.android.compose")
            pluginManager.apply("trackbit.hilt")
            dependencies {
                add("implementation", project(":core:designsystem"))
                add("implementation", project(":core:i18n"))
                add("implementation", libs.library("androidx-glance-appwidget"))
                add("implementation", libs.library("androidx-glance-material3"))
                add("testImplementation", libs.library("androidx-glance-appwidget-testing"))
                add("testImplementation", libs.library("androidx-test-core"))
                add("testImplementation", libs.library("kotlinx-coroutines-test"))
                add("testImplementation", libs.library("robolectric"))
            }
        }
    }
}
