package com.trackbit.core.model

import com.trackbit.core.model.serialization.FallbackEnumSerializer
import com.trackbit.core.model.serialization.WireEnum
import kotlinx.serialization.Serializable

/** `habits.type`. `Negative` is deprecated on the server in favour of `isAntiHabit`. */
@Serializable(with = HabitType.Serializer::class)
enum class HabitType(override val wire: String?) : WireEnum {
    Count("count"),
    Complex("complex"),
    Negative("negative"),
    Timed("timed"),
    Check("check"),
    Unknown(null);

    object Serializer : FallbackEnumSerializer<HabitType>("HabitType", entries, Unknown)
}

/** `COLOR_THEMES` in `@trackbit/types`. */
@Serializable(with = ColorTheme.Serializer::class)
enum class ColorTheme(override val wire: String?) : WireEnum {
    Green("green"),
    Blue("blue"),
    Orange("orange"),
    Purple("purple"),
    Rose("rose"),
    Fire("fire"),
    Custom("custom"),
    Unknown(null);

    object Serializer : FallbackEnumSerializer<ColorTheme>("ColorTheme", entries, Unknown)
}

/** `HABIT_ICON_IDS` in `@trackbit/types`. An id this build doesn't know renders as [Star]. */
@Serializable(with = HabitIcon.Serializer::class)
enum class HabitIcon(override val wire: String) : WireEnum {
    Book("book"),
    Dumbbell("dumbbell"),
    Code("code"),
    Water("water"),
    Sun("sun"),
    Moon("moon"),
    Music("music"),
    Work("work"),
    Coffee("coffee"),
    Ban("ban"),
    Alert("alert"),
    Home("home"),
    Star("star"),
    Heart("heart"),
    Trees("trees");

    object Serializer : FallbackEnumSerializer<HabitIcon>("HabitIcon", entries, Star)
}

/** `user.unitSystem`. */
@Serializable(with = UnitSystem.Serializer::class)
enum class UnitSystem(override val wire: String?) : WireEnum {
    Metric("metric"),
    Imperial("imperial"),
    Unknown(null);

    object Serializer : FallbackEnumSerializer<UnitSystem>("UnitSystem", entries, Unknown)
}

/** `user.exerciseLogCardStyle`. */
@Serializable(with = ExerciseLogCardStyle.Serializer::class)
enum class ExerciseLogCardStyle(override val wire: String?) : WireEnum {
    Classic("classic"),
    Compact("compact"),
    Unknown(null);

    object Serializer : FallbackEnumSerializer<ExerciseLogCardStyle>("ExerciseLogCardStyle", entries, Unknown)
}

/** `EXERCISE_EQUIPMENT` in `@trackbit/types`; the app names each in the user's language. */
@Serializable(with = ExerciseEquipment.Serializer::class)
enum class ExerciseEquipment(override val wire: String?) : WireEnum {
    Barbell("barbell"),
    Dumbbell("dumbbell"),
    Kettlebell("kettlebell"),
    Machine("machine"),
    Cable("cable"),
    Bodyweight("bodyweight"),
    Band("band"),
    Bench("bench"),
    PullUpBar("pull_up_bar"),
    Other("other"),
    Unknown(null);

    object Serializer : FallbackEnumSerializer<ExerciseEquipment>("ExerciseEquipment", entries, Unknown)

    companion object {
        /** What the form offers, in this order. */
        val FORM = entries - Unknown

        fun of(wire: String?): ExerciseEquipment = Serializer.fromWire(wire)
    }
}

/** `EXERCISE_DIFFICULTIES` in `@trackbit/types`. */
@Serializable(with = ExerciseDifficulty.Serializer::class)
enum class ExerciseDifficulty(override val wire: String?) : WireEnum {
    Beginner("beginner"),
    Intermediate("intermediate"),
    Advanced("advanced"),
    Unknown(null);

    object Serializer : FallbackEnumSerializer<ExerciseDifficulty>("ExerciseDifficulty", entries, Unknown)

    companion object {
        val FORM = entries - Unknown

        fun of(wire: String?): ExerciseDifficulty = Serializer.fromWire(wire)
    }
}

/** `exercise_muscle_groups.role`: a primary group is what the exercise trains, a secondary one what it also works. */
@Serializable(with = MuscleGroupRole.Serializer::class)
enum class MuscleGroupRole(override val wire: String?) : WireEnum {
    Primary("primary"),
    Secondary("secondary"),
    Unknown(null);

    object Serializer : FallbackEnumSerializer<MuscleGroupRole>("MuscleGroupRole", entries, Unknown)
}
