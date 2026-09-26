import androidx.room.gradle.RoomExtension
import com.trackbit.buildlogic.library
import com.trackbit.buildlogic.libs
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.dependencies

class RoomConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            pluginManager.apply("androidx.room")
            pluginManager.apply("com.google.devtools.ksp")
            // Exported schemas are committed; they are what migration tests diff against.
            extensions.configure<RoomExtension> {
                schemaDirectory("$projectDir/schemas")
            }
            // `api`: the database class extends RoomDatabase, and repositories use `withTransaction`.
            dependencies {
                add("api", libs.library("androidx-room-runtime"))
                add("api", libs.library("androidx-room-ktx"))
                add("ksp", libs.library("androidx-room-compiler"))
            }
        }
    }
}
