import com.trackbit.buildlogic.library
import com.trackbit.buildlogic.libs
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.dependencies

/**
 * A feature module: a Compose library with Hilt ViewModels, the design system and strings.
 * Features depend on core modules only, never on each other; `app` wires them together.
 */
class AndroidFeatureConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            pluginManager.apply("trackbit.android.library")
            pluginManager.apply("trackbit.android.compose")
            pluginManager.apply("trackbit.hilt")
            dependencies {
                add("implementation", project(":core:designsystem"))
                add("implementation", project(":core:i18n"))
                add("implementation", libs.library("androidx-hilt-lifecycle-viewmodel-compose"))
                add("implementation", libs.library("androidx-lifecycle-runtime-compose"))
                add("testImplementation", libs.library("kotlinx-coroutines-test"))
            }
        }
    }
}
