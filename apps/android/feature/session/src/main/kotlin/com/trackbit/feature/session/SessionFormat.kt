package com.trackbit.feature.session

import androidx.compose.ui.graphics.Color
import com.trackbit.core.data.TrackedSet
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.UnitSystem
import java.math.BigDecimal
import java.math.RoundingMode
import kotlin.math.roundToInt

/** How a log is recorded, from its exercise's `category`. Unknown categories log as strength, as on the web. */
internal enum class ExerciseKind {
    Strength, Cardio, Flexibility;

    companion object {
        fun of(exercise: Exercise?): ExerciseKind = when (exercise?.category) {
            "cardio" -> Cardio
            "flexibility" -> Flexibility
            else -> Strength
        }
    }
}

// Weights are stored in kilograms; imperial users see and enter pounds (the web's intlFormatter).

private const val KG_TO_LBS = 2.20462

/** [kg] in the user's unit: pounds round to the nearest half. */
internal fun kgToDisplay(kg: Double, units: UnitSystem): Double =
    if (units == UnitSystem.Imperial) (kg * KG_TO_LBS * 2).roundToInt() / 2.0 else kg

/** A weight the user entered, back in kilograms (to 0.01 kg, like the web). */
internal fun displayToKg(value: Double, units: UnitSystem): Double =
    if (units == UnitSystem.Imperial) round(value / KG_TO_LBS, 2) else value

internal fun weightUnit(units: UnitSystem): String = if (units == UnitSystem.Imperial) "lbs" else "kg"

/** The weight stepper's step: 5 lb or 2.5 kg. */
internal fun weightStep(units: UnitSystem): Double = if (units == UnitSystem.Imperial) 5.0 else 2.5

/** "60", "62.5": no trailing zeros. */
internal fun formatNumber(value: Double): String = BigDecimal.valueOf(value).stripTrailingZeros().toPlainString()

internal fun round(value: Double, decimals: Int): Double =
    BigDecimal.valueOf(value).setScale(decimals, RoundingMode.HALF_UP).toDouble()

/** The rounded average RPE of the sets that have one, or null if none has. */
internal fun averageRpe(sets: List<TrackedSet>): Int? {
    val values = sets.mapNotNull { it.values.rpe }
    if (values.isEmpty()) return null
    return (values.sum().toDouble() / values.size).roundToInt()
}

/** The web's RPE scale colors: easy green, then amber, orange, red. */
internal fun rpeColor(rpe: Int): Color = when {
    rpe <= 3 -> Color(0xFF10B981)
    rpe <= 6 -> Color(0xFFF59E0B)
    rpe <= 8 -> Color(0xFFF97316)
    else -> Color(0xFFEF4444)
}
