package com.trackbit.feature.analytics

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLocale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.patrykandpatrick.vico.compose.cartesian.CartesianChart
import com.patrykandpatrick.vico.compose.cartesian.CartesianChartHost
import com.patrykandpatrick.vico.compose.cartesian.axis.Axis
import com.patrykandpatrick.vico.compose.cartesian.axis.HorizontalAxis
import com.patrykandpatrick.vico.compose.cartesian.axis.VerticalAxis
import com.patrykandpatrick.vico.compose.cartesian.data.CartesianChartModel
import com.patrykandpatrick.vico.compose.cartesian.data.CartesianLayerModel
import com.patrykandpatrick.vico.compose.cartesian.data.CartesianLayerRangeProvider
import com.patrykandpatrick.vico.compose.cartesian.data.CartesianValueFormatter
import com.patrykandpatrick.vico.compose.cartesian.data.ColumnCartesianLayerModel
import com.patrykandpatrick.vico.compose.cartesian.data.LineCartesianLayerModel
import com.patrykandpatrick.vico.compose.cartesian.layer.CartesianLayer
import com.patrykandpatrick.vico.compose.cartesian.layer.ColumnCartesianLayer
import com.patrykandpatrick.vico.compose.cartesian.layer.LineCartesianLayer
import com.patrykandpatrick.vico.compose.cartesian.layer.rememberColumnCartesianLayer
import com.patrykandpatrick.vico.compose.cartesian.layer.rememberLine
import com.patrykandpatrick.vico.compose.cartesian.layer.rememberLineCartesianLayer
import com.patrykandpatrick.vico.compose.cartesian.marker.CartesianMarkerController
import com.patrykandpatrick.vico.compose.cartesian.marker.DefaultCartesianMarker
import com.patrykandpatrick.vico.compose.cartesian.marker.rememberDefaultCartesianMarker
import com.patrykandpatrick.vico.compose.cartesian.rememberCartesianChart
import com.patrykandpatrick.vico.compose.cartesian.rememberVicoScrollState
import com.patrykandpatrick.vico.compose.common.Fill
import com.patrykandpatrick.vico.compose.common.Insets
import com.patrykandpatrick.vico.compose.common.ProvideVicoTheme
import com.patrykandpatrick.vico.compose.common.component.rememberLineComponent
import com.patrykandpatrick.vico.compose.common.component.rememberShapeComponent
import com.patrykandpatrick.vico.compose.common.component.rememberTextComponent
import com.patrykandpatrick.vico.compose.common.data.ExtraStore
import com.patrykandpatrick.vico.compose.m3.common.rememberM3VicoTheme
import com.trackbit.core.designsystem.format.formatNumber
import com.trackbit.core.designsystem.format.kgToDisplay
import com.trackbit.core.designsystem.format.weightUnit
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.i18n.R
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.HabitSet
import com.trackbit.core.model.UnitSystem
import java.text.NumberFormat
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale
import kotlin.math.ceil
import kotlin.math.max

// The web's ExerciseChart, VolumeChart and MuscleChart. Colors are the web's.

private val Blue = Color(0xFF3B82F6)
private val Amber = Color(0xFFF59E0B)
private val Emerald = Color(0xFF10B981)
private val Purple = Color(0xFF8B5CF6)

/** The stacked bars' colors, by exercise in id order (the web's `EXERCISE_COLORS`). */
private val ExerciseColors = listOf(
    Color(0xFF3B82F6), Color(0xFF10B981), Color(0xFFF59E0B), Color(0xFF8B5CF6), Color(0xFFEF4444),
    Color(0xFF06B6D4), Color(0xFFF97316), Color(0xFF84CC16), Color(0xFFEC4899), Color(0xFF6366F1),
)

private const val CHART_HEIGHT = 220
private const val AXIS_LABELS = 5

// --- Exercise progression ---

@Composable
internal fun ExerciseChartCard(sets: List<HabitSet>, catalog: List<Exercise>, units: UnitSystem, today: LocalDate) {
    val used = remember(sets, catalog) { usedExercises(sets, catalog) }
    if (used.isEmpty()) {
        OutlinedCard(Modifier.fillMaxWidth()) { CenteredText(R.string.analytics_exercise_empty) }
        return
    }
    var exerciseId by rememberSaveable { mutableStateOf<Int?>(null) }
    var metric by rememberSaveable { mutableStateOf(ExerciseMetric.MaxWeight) }
    var range by rememberSaveable { mutableStateOf(TimeRange.DEFAULT) }
    val exercise = used.find { it.id == exerciseId } ?: used.first()
    val series = remember(sets, exercise.id, metric, range, today) { exerciseSeries(sets, exercise.id, metric, range, today) }
    val isWeight = metric != ExerciseMetric.AvgRpe
    val unit = if (isWeight) weightUnit(units) else "RPE"
    val values = remember(series, units, isWeight) { series.points.map { if (isWeight) kgToDisplay(it.value, units) else it.value } }

    ChartCard(
        icon = UiIcons.TrendingUp,
        tint = Blue,
        header = { ExerciseDropdown(used, exercise) { exerciseId = it } },
        controls = {
            Segmented(
                listOf(
                    ExerciseMetric.MaxWeight to stringResource(R.string.analytics_metric_max_weight),
                    ExerciseMetric.TotalVolume to stringResource(R.string.analytics_metric_volume),
                    ExerciseMetric.EstimatedOneRm to stringResource(R.string.analytics_metric_one_rm),
                    ExerciseMetric.AvgRpe to stringResource(R.string.analytics_metric_avg_rpe),
                ),
                metric,
                { metric = it },
            )
            Segmented(rangeOptions(), range, { range = it })
        },
    ) {
        if (series.points.isEmpty()) {
            CenteredText(stringResource(R.string.analytics_exercise_no_data, exercise.name))
            return@ChartCard
        }
        Summary(
            listOfNotNull(
                series.best?.let { best ->
                    Triple(stringResource(R.string.analytics_best_in_range), "${formatNumber(if (isWeight) kgToDisplay(best, units) else best)} $unit", null)
                },
                Triple(stringResource(R.string.analytics_prs_in_range), series.prCount.toString(), Amber),
                Triple(stringResource(R.string.analytics_sessions), series.points.size.toString(), null),
            ),
        )
        ProvideVicoTheme(rememberM3VicoTheme()) {
            ProgressionChart(series.points, values, if (isWeight) Blue else Amber, unit)
        }
    }
}

@Composable
private fun ExerciseDropdown(exercises: List<Exercise>, selected: Exercise, onSelect: (Int) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        TextButton(onClick = { open = true }) {
            Text(
                selected.name,
                style = MaterialTheme.typography.titleSmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.widthIn(max = 220.dp),
            )
            Icon(painterResource(UiIcons.ChevronDown), null, Modifier.padding(start = 4.dp).size(14.dp))
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            for (exercise in exercises) {
                DropdownMenuItem(
                    text = { Text(exercise.name) },
                    onClick = {
                        open = false
                        onSelect(exercise.id)
                    },
                )
            }
        }
    }
}

/** One point per session day ([values] in the shown unit), PRs dotted in amber. */
@Composable
private fun ProgressionChart(points: List<ExercisePoint>, values: List<Double>, color: Color, unit: String) {
    val prDot = LineCartesianLayer.Point(
        rememberShapeComponent(Fill(Amber), CircleShape, strokeFill = Fill(MaterialTheme.colorScheme.surface), strokeThickness = 2.dp),
        size = 10.dp,
    )
    val prs = remember(points) { points.indices.filterTo(HashSet()) { points[it].isPr } }
    val pointProvider = remember(prs, prDot) {
        object : LineCartesianLayer.PointProvider {
            override fun getPoint(entry: LineCartesianLayerModel.Entry, extraStore: ExtraStore) =
                if (entry.x.toInt() in prs) prDot else null

            override fun getLargestPoint(extraStore: ExtraStore) = prDot
        }
    }
    val line = LineCartesianLayer.rememberLine(
        fill = remember(color) { LineCartesianLayer.LineFill.single(Fill(color)) },
        areaFill = remember(color) {
            LineCartesianLayer.AreaFill.single(Fill(Brush.verticalGradient(listOf(color.copy(alpha = 0.15f), Color.Transparent))))
        },
        pointProvider = pointProvider,
        interpolator = LineCartesianLayer.Interpolator.cubic(),
    )
    val prLabel = stringResource(R.string.analytics_personal_record)
    val days = remember(points) { points.map { it.day } }
    val marker = rememberMarker { x ->
        val i = x.toInt()
        buildString {
            append("${days[i].format(MEDIUM_DATE)}: ${formatNumber(values[i])} $unit")
            if (i in prs) append("\n$prLabel")
        }
    }
    val chart = rememberCartesianChart(
        rememberLineCartesianLayer(remember(line) { LineCartesianLayer.LineProvider.series(line) }),
        startAxis = VerticalAxis.rememberStart(valueFormatter = remember { compactFormatter() }),
        bottomAxis = rememberDayAxis(days),
        marker = marker,
        // A tap shows a point's values until the next tap, like the web's tooltip on a phone.
        markerController = CartesianMarkerController.rememberToggleOnTap(),
    )
    val model = remember(values) { CartesianChartModel(LineCartesianLayerModel.build { series(values) }) }
    Chart(chart, model)
}

// --- Weekly volume ---

private enum class VolumeBreakdown { Total, ByExercise }

@Composable
internal fun VolumeChartCard(sets: List<HabitSet>, catalog: List<Exercise>, units: UnitSystem, today: LocalDate) {
    var range by rememberSaveable { mutableStateOf(TimeRange.DEFAULT) }
    var breakdown by rememberSaveable { mutableStateOf(VolumeBreakdown.Total) }
    var showRpe by rememberSaveable { mutableStateOf(false) }
    val volume = remember(sets, range, today) { weeklyVolume(sets, range, today) }
    val unit = weightUnit(units)

    ChartCard(
        icon = UiIcons.BarChart2,
        tint = Emerald,
        header = { Text(stringResource(R.string.analytics_volume_title), style = MaterialTheme.typography.titleSmall) },
        controls = {
            Segmented(
                listOf(
                    VolumeBreakdown.Total to stringResource(R.string.analytics_volume_total),
                    VolumeBreakdown.ByExercise to stringResource(R.string.analytics_volume_by_exercise),
                ),
                breakdown,
                { breakdown = it },
            )
            Segmented(rangeOptions(), range, { range = it })
            FilterChip(
                selected = showRpe,
                onClick = { showRpe = !showRpe },
                label = { Text(stringResource(R.string.analytics_volume_rpe_overlay)) },
            )
        },
    ) {
        if (volume.weeks.isEmpty()) {
            CenteredText(R.string.analytics_volume_empty)
            return@ChartCard
        }
        val weekFormat = rememberShortDate()
        Summary(
            listOfNotNull(
                Triple(stringResource(R.string.analytics_volume_total_volume), "${compact(kgToDisplay(volume.totalVolume, units))} $unit", null),
                volume.avgRpe?.let { Triple(stringResource(R.string.analytics_metric_avg_rpe), formatNumber(it), Amber) },
                volume.peakWeek?.let { Triple(stringResource(R.string.analytics_volume_peak_week), it.weekStart.format(weekFormat), null) },
                Triple(stringResource(R.string.analytics_volume_weeks_tracked), volume.weeks.size.toString(), null),
            ),
        )
        val names = remember(catalog) { catalog.associate { it.id to it.name } }
        ProvideVicoTheme(rememberM3VicoTheme()) {
            VolumeChart(volume, breakdown, showRpe, units, unit, names)
        }
        if (breakdown == VolumeBreakdown.ByExercise) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                volume.exerciseIds.forEachIndexed { i, id ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(8.dp).background(ExerciseColors[i % ExerciseColors.size], CircleShape))
                        Text(
                            names[id] ?: "#$id",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(start = 4.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun VolumeChart(volume: VolumeData, breakdown: VolumeBreakdown, showRpe: Boolean, units: UnitSystem, unit: String, names: Map<Int, String>) {
    val stacked = breakdown == VolumeBreakdown.ByExercise
    val columnColors = if (stacked) volume.exerciseIds.indices.map { ExerciseColors[it % ExerciseColors.size] } else listOf(Emerald)
    val columns = columnColors.map { rememberLineComponent(Fill(it), 12.dp, RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp)) }
    val columnLayer = rememberColumnCartesianLayer(
        columnProvider = remember(columns) { ColumnCartesianLayer.ColumnProvider.series(columns) },
        mergeMode = remember(stacked) { { if (stacked) ColumnCartesianLayer.MergeMode.Stacked else ColumnCartesianLayer.MergeMode.Grouped() } },
    )
    val rpeLine = LineCartesianLayer.rememberLine(
        fill = remember { LineCartesianLayer.LineFill.single(Fill(Amber)) },
        pointProvider = LineCartesianLayer.PointProvider.single(
            LineCartesianLayer.Point(rememberShapeComponent(Fill(Amber), CircleShape), size = 6.dp),
        ),
    )
    val rpeLayer = rememberLineCartesianLayer(
        lineProvider = remember(rpeLine) { LineCartesianLayer.LineProvider.series(rpeLine) },
        rangeProvider = remember { CartesianLayerRangeProvider.fixed(minY = 0.0, maxY = 10.0) },
        verticalAxisPosition = Axis.Position.Vertical.End,
    )
    val weeks = remember(volume) { volume.weeks.map { it.weekStart } }
    val weekFormat = rememberShortDate()
    val volumeLabel = stringResource(R.string.analytics_metric_volume)
    val rpeLabel = stringResource(R.string.analytics_metric_avg_rpe)
    val marker = rememberMarker { x ->
        val week = volume.weeks[x.toInt()]
        buildString {
            append(week.weekStart.format(weekFormat))
            if (stacked) {
                for (id in volume.exerciseIds) {
                    val kg = week.byExercise[id] ?: continue
                    append("\n${names[id] ?: "#$id"}: ${formatNumber(kgToDisplay(kg, units))} $unit")
                }
            } else {
                append("\n$volumeLabel: ${formatNumber(kgToDisplay(week.total, units))} $unit")
            }
            if (showRpe && week.avgRpe != null) append("\n$rpeLabel: ${formatNumber(week.avgRpe)}")
        }
    }
    val rpeWeeks = volume.weeks.indices.filter { volume.weeks[it].avgRpe != null }
    val withRpe = showRpe && rpeWeeks.isNotEmpty()
    val layers: Array<CartesianLayer<*>> = if (withRpe) arrayOf(columnLayer, rpeLayer) else arrayOf(columnLayer)
    val chart = rememberCartesianChart(
        *layers,
        startAxis = VerticalAxis.rememberStart(valueFormatter = remember { compactFormatter() }),
        endAxis = if (withRpe) VerticalAxis.rememberEnd(guideline = null) else null,
        bottomAxis = rememberDayAxis(weeks, weekFormat),
        marker = marker,
        // A tap shows a point's values until the next tap, like the web's tooltip on a phone.
        markerController = CartesianMarkerController.rememberToggleOnTap(),
    )
    val model = remember(volume, stacked, withRpe, units) {
        val bars = ColumnCartesianLayerModel.build {
            if (stacked) {
                for (id in volume.exerciseIds) series(volume.weeks.map { kgToDisplay(it.byExercise[id] ?: 0.0, units) })
            } else {
                series(volume.weeks.map { kgToDisplay(it.total, units) })
            }
        }
        val models = mutableListOf<CartesianLayerModel>(bars)
        if (withRpe) models += LineCartesianLayerModel.build { series(rpeWeeks, rpeWeeks.map { volume.weeks[it].avgRpe!! }) }
        CartesianChartModel(models)
    }
    Chart(chart, model)
}

// --- Muscle balance ---

@Composable
internal fun MuscleBalanceCard(sets: List<HabitSet>, catalog: List<Exercise>, units: UnitSystem, today: LocalDate) {
    var range by rememberSaveable { mutableStateOf(TimeRange.DEFAULT) }
    var metric by rememberSaveable { mutableStateOf(MuscleMetric.Volume) }
    val balance = remember(sets, catalog, metric, range, today) { muscleBalance(sets, catalog, metric, range, today) }
    val unit = weightUnit(units)

    ChartCard(
        icon = UiIcons.Activity,
        tint = Purple,
        header = { Text(stringResource(R.string.analytics_muscle_title), style = MaterialTheme.typography.titleSmall) },
        controls = {
            Segmented(
                listOf(
                    MuscleMetric.Volume to stringResource(R.string.analytics_metric_volume),
                    MuscleMetric.Frequency to stringResource(R.string.analytics_muscle_frequency),
                ),
                metric,
                { metric = it },
            )
            Segmented(rangeOptions(), range, { range = it })
        },
    ) {
        val top = balance.top
        if (top == null) {
            CenteredText(R.string.android_analytics_muscle_empty)
            return@ChartCard
        }
        val sessionsOf: @Composable (Double) -> String = { pluralStringResource(R.plurals.analytics_muscle_sessions, it.toInt(), it.toInt()) }
        val format: @Composable (Double) -> String = { value ->
            if (metric == MuscleMetric.Volume) "${compact(kgToDisplay(value, units))} $unit" else sessionsOf(value)
        }
        val least = balance.least?.takeIf { it.group != top.group }
        Summary(
            listOfNotNull(
                Triple(stringResource(R.string.analytics_muscle_most_trained), top.group.name, Purple),
                least?.let { Triple(stringResource(R.string.analytics_muscle_least_trained), it.group.name, MaterialTheme.colorScheme.onSurfaceVariant) },
                Triple(stringResource(R.string.analytics_muscle_groups), balance.values.size.toString(), null),
                Triple(
                    stringResource(if (metric == MuscleMetric.Volume) R.string.analytics_muscle_peak_volume else R.string.analytics_muscle_peak_frequency),
                    format(top.value),
                    null,
                ),
            ),
        )
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            for (value in balance.values) {
                Column {
                    Row {
                        Text(value.group.name, style = MaterialTheme.typography.labelMedium, modifier = Modifier.weight(1f))
                        Text(format(value.value), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Box(Modifier.fillMaxWidth().height(8.dp).background(MaterialTheme.colorScheme.surfaceVariant, CircleShape)) {
                        Box(
                            Modifier
                                .fillMaxWidth((value.value / top.value).toFloat().coerceIn(0.02f, 1f))
                                .height(8.dp)
                                .background(Purple, CircleShape),
                        )
                    }
                }
            }
        }
    }
}

// --- Chart plumbing ---

private val MEDIUM_DATE: DateTimeFormatter get() = DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)

/** The chart at its fixed height, fitted to the width rather than scrolled. */
@Composable
private fun Chart(chart: CartesianChart, model: CartesianChartModel) {
    CartesianChartHost(
        chart = chart,
        model = model,
        modifier = Modifier.fillMaxWidth().height(CHART_HEIGHT.dp),
        scrollState = rememberVicoScrollState(scrollEnabled = false),
    )
}

/** A bottom axis naming each x (an index into [days]) by its day, about [AXIS_LABELS] labels across. */
@Composable
private fun rememberDayAxis(days: List<LocalDate>, format: DateTimeFormatter = rememberShortDate()) =
    HorizontalAxis.rememberBottom(
        valueFormatter = remember(days, format) { CartesianValueFormatter { _, x, _ -> days.getOrNull(x.toInt())?.format(format).orEmpty() } },
        guideline = null,
        itemPlacer = remember(days.size) {
            HorizontalAxis.ItemPlacer.aligned(spacing = { max(1, ceil(days.size / AXIS_LABELS.toDouble()).toInt()) })
        },
    )

/** "Oct 3", in the app's locale. */
@Composable
private fun rememberShortDate(): DateTimeFormatter {
    val locale = LocalLocale.current.platformLocale
    return remember(locale) { DateTimeFormatter.ofPattern("MMM d", locale) }
}

/** A tap marker whose label is [label] of the tapped x. */
@Composable
private fun rememberMarker(label: (Double) -> String): DefaultCartesianMarker {
    val text = rememberTextComponent(
        style = TextStyle(color = MaterialTheme.colorScheme.onSurface, fontSize = 12.sp),
        lineCount = 8,
        padding = Insets(8.dp, 4.dp),
        background = rememberShapeComponent(Fill(MaterialTheme.colorScheme.surfaceContainerHighest), RoundedCornerShape(8.dp)),
    )
    return rememberDefaultCartesianMarker(
        label = text,
        // Over the tapped point, so the chart reserves no room for a multi-line label.
        labelPosition = DefaultCartesianMarker.LabelPosition.AroundPoint,
        valueFormatter = DefaultCartesianMarker.ValueFormatter { _, targets -> label(targets.first().x) },
    )
}

/** "1.2k" from a thousand on, else the locale's number. */
private fun compact(value: Double): String =
    if (value >= 1000) "%.1fk".format(Locale.getDefault(), value / 1000) else NumberFormat.getInstance().format(value)

private fun compactFormatter() = CartesianValueFormatter { _, value, _ -> compact(value) }
