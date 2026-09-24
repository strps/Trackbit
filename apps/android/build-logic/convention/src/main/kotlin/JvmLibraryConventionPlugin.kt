import com.trackbit.buildlogic.configureKotlin
import com.trackbit.buildlogic.library
import com.trackbit.buildlogic.libs
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.dependencies

/** A pure Kotlin/JVM module: no Android dependencies. */
class JvmLibraryConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            pluginManager.apply("org.jetbrains.kotlin.jvm")
            pluginManager.apply("com.android.lint")
            configureKotlin()
            dependencies {
                add("testImplementation", libs.library("junit"))
            }
            // Android modules expose `testDebugUnitTest` and `lintDebug`; alias them here so
            // one `./gradlew testDebugUnitTest lintDebug` covers every module, JVM ones included.
            tasks.register("testDebugUnitTest") { dependsOn("test") }
            tasks.register("lintDebug") { dependsOn("lint") }
        }
    }
}
