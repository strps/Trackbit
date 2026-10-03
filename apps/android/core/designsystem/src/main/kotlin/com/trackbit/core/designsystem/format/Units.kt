package com.trackbit.core.designsystem.format

import com.trackbit.core.model.UnitSystem
import java.math.BigDecimal
import java.math.RoundingMode
import kotlin.math.roundToInt

// Weights are stored in kilograms; imperial users see and enter pounds (the web's intlFormatter).

private const val KG_TO_LBS = 2.20462

/** [kg] in the user's unit: pounds round to the nearest half. */
fun kgToDisplay(kg: Double, units: UnitSystem): Double =
    if (units == UnitSystem.Imperial) (kg * KG_TO_LBS * 2).roundToInt() / 2.0 else kg

/** A weight the user entered, back in kilograms (to 0.01 kg, like the web). */
fun displayToKg(value: Double, units: UnitSystem): Double =
    if (units == UnitSystem.Imperial) round(value / KG_TO_LBS, 2) else value

fun weightUnit(units: UnitSystem): String = if (units == UnitSystem.Imperial) "lbs" else "kg"

/** "60", "62.5": no trailing zeros. */
fun formatNumber(value: Double): String = BigDecimal.valueOf(value).stripTrailingZeros().toPlainString()

fun round(value: Double, decimals: Int): Double =
    BigDecimal.valueOf(value).setScale(decimals, RoundingMode.HALF_UP).toDouble()
