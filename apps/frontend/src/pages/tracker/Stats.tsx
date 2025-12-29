import { BarChart3, CheckCircle2, Flame } from "lucide-react";
import { useTracker } from "@/hooks/use-tracker";
import { format, differenceInDays, startOfDay, subDays } from "date-fns";

export const Stats = () => {
  const { habitsWithLogs, selectedHabitId } = useTracker();

  const habit = selectedHabitId ? habitsWithLogs[selectedHabitId] : undefined;
  const dayLogs = habit?.dayLogs ?? {};

  const loggedDates = Object.keys(dayLogs).sort().reverse(); // newest first

  // 1. Total Completions
  const totalCompletions = loggedDates.filter((date) => {
    const log = dayLogs[date];
    // Completed if rating exists (simple habit) OR has exercise sessions
    return log.rating !== undefined || (log.exerciseSessions && log.exerciseSessions.length > 0);
  }).length;

  // 2. Current Streak
  let currentStreak = 0;
  if (loggedDates.length > 0) {
    const today = format(new Date(), "yyyy-MM-dd");
    let expectedDate = startOfDay(new Date());

    while (true) {
      const dateStr = format(expectedDate, "yyyy-MM-dd");
      const log = dayLogs[dateStr];
      const isCompleted =
        log?.rating !== undefined || (log?.exerciseSessions && log.exerciseSessions.length > 0);

      if (isCompleted) {
        currentStreak++;
        expectedDate = subDays(expectedDate, 1);
      } else {
        break;
      }
    }
  }

  // 3. Goal Frequency (percentage of days logged)
  let goalFrequency = "0%";
  if (habit && loggedDates.length > 0) {
    // Use habit.createdAt if available; otherwise fall back to earliest log
    const startDateStr = loggedDates[loggedDates.length - 1]; // oldest
    const startDate = new Date(startDateStr);
    const endDate = new Date(); // today

    const totalDays = differenceInDays(endDate, startDate) + 1;
    const completedDays = totalCompletions;

    goalFrequency = totalDays > 0 ? `${Math.round((completedDays / totalDays) * 100)}%` : "0%";
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard
        title="Total Completions"
        value={totalCompletions}
        icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
      />
      <StatCard
        title="Current Streak"
        value={currentStreak}
        icon={<Flame className="w-5 h-5 text-orange-500" />}
        trend={currentStreak > 0 ? "Keep the fire burning!" : "Start a new streak today"}
      />
      <StatCard
        title="Goal Frequency"
        value={goalFrequency}
        icon={<BarChart3 className="w-5 h-5 text-blue-500" />}
        trend="Consistency over time"
      />
    </div>
  );
};

interface StatCardProps {
  title?: string;
  value?: string | number;
  icon?: React.ReactNode;
  trend?: string;
}

const StatCard = ({ title, value = 0, icon, trend }: StatCardProps) => (
  <div className="bg-card text-card-foreground p-6 rounded-xl border shadow-sm flex flex-col gap-4">
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-sm font-medium">{title}</span>
      <div className="p-2 bg-muted rounded-lg">{icon}</div>
    </div>
    <div>
      <h3 className="text-2xl font-bold">{value ?? "-"}</h3>
      {trend && <p className="text-xs text-muted-foreground mt-1">{trend}</p>}
    </div>
  </div>
);