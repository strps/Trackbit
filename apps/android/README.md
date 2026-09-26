# Trackbit for Android

Native Android client (Kotlin + Jetpack Compose). It is a standalone Gradle project inside the monorepo, not a pnpm workspace. The plan is [docs/dev/tasks/kotlin-app.md](../../docs/dev/tasks/kotlin-app.md).

## Setup

1. **JDK 21.** Gradle uses it for the build and for the Kotlin/Java toolchain.
2. **Android SDK.** Set `ANDROID_HOME`, or create `apps/android/local.properties` (git-ignored) with `sdk.dir=/path/to/Android/Sdk`. AGP downloads the missing platforms (compileSdk 37) by itself, as long as the SDK licenses are accepted.
3. You don't need to install Gradle. `./gradlew` downloads the pinned version (see `gradle/wrapper/gradle-wrapper.properties`).

## Run it

From the repo root:

```bash
pnpm dev:backend         # the API on :3000
pnpm android:build       # assembleDebug → app/build/outputs/apk/debug/app-debug.apk
pnpm android:test        # unit tests, every module (JVM modules included)
pnpm android:lint        # Android lint, every module
```

Alternatively, open `apps/android/` in Android Studio and run the `app` configuration on an emulator.

Debug builds call `http://10.0.2.2:3000/`, which is how the emulator reaches the host's localhost. Cleartext HTTP is allowed only in debug builds, and only to `10.0.2.2` and `localhost` (see [network_security_config.xml](app/src/debug/res/xml/network_security_config.xml)). On a physical device, run `adb reverse tcp:3000 tcp:3000` first.

Release builds need the backend URL, which must end in `/`:

```bash
./gradlew assembleRelease -PTRACKBIT_API_URL=https://api.example.com/
# or: TRACKBIT_API_URL=https://api.example.com/ ./gradlew assembleRelease
```

## Layout

```
app/                  Application, MainActivity, nav host, Hilt root
build-logic/          convention plugins (trackbit.android.application, .library, .compose,
                      .feature, trackbit.hilt, trackbit.room, trackbit.jvm.library)
core/model            DTOs + domain logic. Pure Kotlin/JVM, no Android
core/network          Retrofit, interceptors, error mapping
core/database         Room cache + outbox
core/data             repositories, sync, workers
core/auth             session/token store
core/designsystem     theme, colors, icons, shared composables
core/i18n             generated string resources
feature/*             one module per screen group (trackbit.android.feature: Compose, Hilt
                      ViewModels, designsystem, i18n)
widget/               Glance widgets
```

`feature/*` and `widget` depend only on `core/*`, never on each other. `app` wires everything together. Library versions live in [gradle/libs.versions.toml](gradle/libs.versions.toml). Module build files apply convention plugins and declare their dependencies, and nothing else.

## Generated from the web app

[scripts/generate.mjs](scripts/generate.mjs) writes these files from the web sources, so that nothing is copied by hand. Never edit the outputs; change the source and regenerate.

| Output | Source |
|---|---|
| `core/i18n` `values[-es]/strings.xml` | `apps/frontend/src/i18n/locales/{en,es}/*.json`. `ns:key.sub` becomes `ns_key_sub`, ICU `{arg}` becomes `%N$s`, and a plural becomes `<plurals>` |
| `core/model` `GradientPresets.kt` | `GRADIENT_PRESET_STOPS` in `@trackbit/types` |
| `core/designsystem` `WebColors.kt` | the oklch tokens in `apps/frontend/src/index.css`, converted to sRGB |
| `core/designsystem` `drawable/ic_habit_*.xml` | `HABIT_ICON_IDS`, drawn with the lucide icons from the web's `habit-icons.ts` |

It also fails if the handwritten `HabitIcon` / `ColorTheme` enums drift from `@trackbit/types`. It needs `pnpm install` first.

```bash
pnpm android:generate          # regenerate after changing a source
pnpm android:generate:check    # what CI runs: fails if an output is stale
```

Android-only strings (widget labels, notification actions) go in a hand-written `strings_android.xml`, not in the generated file.

## CI

[.github/workflows/android.yml](../../.github/workflows/android.yml) has two jobs. `generated` runs `pnpm android:generate:check`. `build` runs `assembleDebug testDebugUnitTest lintDebug` and uploads the debug APK. The workflow triggers on changes to this directory and to each of the generator's sources.
