import React, { useMemo } from "react";
import { ScrollView } from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";
import { mapValueToRgbaString } from "@/lib/color-utils";
import type { ColorStop } from "@/lib/habits-api";
import { useTheme } from "@/hooks/use-theme";

const CELL = 10;
const GAP = 2;
const STEP = CELL + GAP;
const DAY_LABEL_W = 26;
const MONTH_ROW_H = 14;

const DEFAULT_COLOR_STOPS: ColorStop[] = [
  { position: 0, color: [16, 185, 249, 0] },
  { position: 1, color: [16, 185, 129, 1] },
];

const WEEKDAY_LABELS = ["Mon", "Wed", "Fri"];
const WEEKDAY_ROWS = [0, 2, 4]; // dayIdx for Mon, Wed, Fri (week starts Monday)

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return toDateStr(d);
}

function buildWeeks(today: string, numWeeks: number): string[][] {
  // End = today. Start = numWeeks * 7 - 1 days back, then roll back to Monday.
  const endDate = new Date(today + "T12:00:00Z");
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - (numWeeks * 7 - 1));

  // Roll back to Monday (UTC day: 0=Sun, 1=Mon ... 6=Sat)
  const dow = startDate.getUTCDay();
  const toMonday = dow === 0 ? -6 : 1 - dow;
  startDate.setUTCDate(startDate.getUTCDate() + toMonday);

  const weeks: string[][] = [];
  let cur = new Date(startDate);

  while (cur <= endDate) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(toDateStr(cur));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

interface HeatmapProps {
  getRating: (date: string) => number;
  maxValue?: number;
  colorStops?: ColorStop[];
  selectedDate?: string;
  onDateSelect?: (date: string) => void;
  today?: string;
  numWeeks?: number;
}

export function Heatmap({
  getRating,
  maxValue = 1,
  colorStops = DEFAULT_COLOR_STOPS,
  selectedDate,
  onDateSelect,
  today,
  numWeeks = 52,
}: HeatmapProps) {
  const theme = useTheme();
  const todayStr = today ?? toDateStr(new Date());

  const weeks = useMemo(() => buildWeeks(todayStr, numWeeks), [todayStr, numWeeks]);

  const monthLabels = useMemo(() => {
    const labels: { label: string; x: number }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, i) => {
      const month = new Date(week[0] + "T12:00:00Z").getUTCMonth();
      if (month !== lastMonth) {
        labels.push({ label: MONTH_NAMES[month], x: DAY_LABEL_W + GAP + i * STEP });
        lastMonth = month;
      }
    });
    return labels;
  }, [weeks]);

  const svgW = DAY_LABEL_W + GAP + weeks.length * STEP;
  const svgH = MONTH_ROW_H + 7 * STEP;

  const emptyColor = theme.backgroundElement;
  const selectedStroke = theme.text;
  const todayStroke = theme.textSecondary;

  const effectiveStops =
    colorStops && colorStops.length > 0 ? colorStops : DEFAULT_COLOR_STOPS;

  const cells = useMemo(() => {
    return weeks.flatMap((week, wi) =>
      week.map((dateStr, di) => {
        const isFuture = dateStr > todayStr;
        const rating = isFuture ? 0 : getRating(dateStr);
        const fill = isFuture
          ? "transparent"
          : rating > 0
          ? mapValueToRgbaString(rating, 0, maxValue, effectiveStops)
          : emptyColor;
        const isSelected = dateStr === selectedDate;
        const isToday = dateStr === todayStr;
        const x = DAY_LABEL_W + GAP + wi * STEP;
        const y = MONTH_ROW_H + di * STEP;
        return { dateStr, fill, isSelected, isToday, isFuture, x, y };
      })
    );
  }, [weeks, todayStr, getRating, maxValue, colorStops, selectedDate, emptyColor]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: 4 }}
    >
      <Svg width={svgW} height={svgH}>
        {/* Month labels */}
        {monthLabels.map(({ label, x }) => (
          <SvgText
            key={label + x}
            x={x}
            y={MONTH_ROW_H - 2}
            fontSize={9}
            fill={theme.textSecondary}
            fontWeight="bold"
          >
            {label}
          </SvgText>
        ))}

        {/* Weekday labels */}
        {WEEKDAY_LABELS.map((label, i) => (
          <SvgText
            key={label}
            x={DAY_LABEL_W - 2}
            y={MONTH_ROW_H + WEEKDAY_ROWS[i] * STEP + CELL}
            fontSize={8}
            fill={theme.textSecondary}
            textAnchor="end"
          >
            {label}
          </SvgText>
        ))}

        {/* Day cells */}
        {cells.map(({ dateStr, fill, isSelected, isToday, isFuture, x, y }) => (
          <React.Fragment key={dateStr}>
            <Rect
              x={x}
              y={y}
              width={CELL}
              height={CELL}
              rx={2}
              fill={fill}
              onPress={isFuture ? undefined : () => onDateSelect?.(dateStr)}
            />
            {(isToday || isSelected) && (
              <Rect
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                rx={2}
                fill="none"
                stroke={isSelected ? selectedStroke : todayStroke}
                strokeWidth={1.5}
              />
            )}
          </React.Fragment>
        ))}
      </Svg>
    </ScrollView>
  );
}
