pluginManagement {
    includeBuild("build-logic")
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode = RepositoriesMode.FAIL_ON_PROJECT_REPOS
    repositories {
        google()
        mavenCentral()
    }
}

enableFeaturePreview("TYPESAFE_PROJECT_ACCESSORS")

rootProject.name = "trackbit"

include(":app")
include(":core:model")
include(":core:network")
include(":core:database")
include(":core:data")
include(":core:auth")
include(":core:designsystem")
include(":core:i18n")
include(":feature:analytics")
include(":feature:auth")
include(":feature:session")
include(":feature:tracker")
include(":widget")
