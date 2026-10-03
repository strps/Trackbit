package com.trackbit.core.designsystem.component

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLocale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.TextStyle
import java.time.temporal.TemporalAdjusters

/**
 * The web's `Heatmap`: [weeks] calendar weeks ending with [today]'s, one column per week from
 * [firstDayOfWeek], scrolled to today. [colorOf] gives a day's color, or null for nothing to mark.
 * Tapping a day selects it; [selected] is outlined.
 */
@Composable
fun Heatmap(
    today: LocalDate,
    weeks: Int,
    firstDayOfWeek: DayOfWeek,
    colorOf: (LocalDate) -> Color?,
    selected: LocalDate?,
    onSelect: (LocalDate) -> Unit,
    modifier: Modifier = Modifier,
) {
    val locale = LocalLocale.current.platformLocale
    val columns = remember(today, weeks, firstDayOfWeek) {
        val thisWeek = today.with(TemporalAdjusters.previousOrSame(firstDayOfWeek))
        (weeks - 1 downTo 0).map { back -> thisWeek.minusWeeks(back.toLong()) }
    }
    val listState = rememberLazyListState(initialFirstVisibleItemIndex = columns.lastIndex)
    val empty = MaterialTheme.colorScheme.surfaceVariant
    val outline = MaterialTheme.colorScheme.onSurface
    val labelStyle = MaterialTheme.typography.labelSmall
    val labelColor = MaterialTheme.colorScheme.onSurfaceVariant

    Row(modifier) {
        // Weekday labels on alternate rows, like GitHub's.
        Column(verticalArrangement = Arrangement.spacedBy(GAP)) {
            Box(Modifier.height(MONTH_ROW))
            repeat(DAYS_PER_WEEK) { row ->
                val day = firstDayOfWeek.plus(row.toLong())
                Box(Modifier.height(CELL)) {
                    if (row % 2 == 1) Text(day.getDisplayName(TextStyle.SHORT, locale), style = labelStyle, color = labelColor)
                }
            }
        }
        LazyRow(state = listState, horizontalArrangement = Arrangement.spacedBy(GAP)) {
            itemsIndexed(columns) { index, weekStart ->
                Column(verticalArrangement = Arrangement.spacedBy(GAP)) {
                    // The month's name over its first week.
                    val newMonth = index == 0 || columns[index - 1].month != weekStart.month
                    Box(Modifier.height(MONTH_ROW).size(width = CELL, height = MONTH_ROW)) {
                        if (newMonth) {
                            Text(
                                text = weekStart.month.getDisplayName(TextStyle.SHORT, locale),
                                style = labelStyle,
                                color = labelColor,
                                maxLines = 1,
                                softWrap = false,
                                overflow = TextOverflow.Visible,
                            )
                        }
                    }
                    repeat(DAYS_PER_WEEK) { row ->
                        val day = weekStart.plusDays(row.toLong())
                        if (day.isAfter(today)) {
                            Box(Modifier.size(CELL))
                        } else {
                            Box(
                                Modifier
                                    .size(CELL)
                                    .background(colorOf(day) ?: empty, SHAPE)
                                    .then(if (day == selected) Modifier.border(1.5.dp, outline, SHAPE) else Modifier)
                                    .clickable { onSelect(day) },
                            )
                        }
                    }
                }
            }
        }
    }
}

private const val DAYS_PER_WEEK = 7
private val CELL = 14.dp
private val GAP = 3.dp
private val MONTH_ROW = 16.dp
private val SHAPE = RoundedCornerShape(3.dp)
