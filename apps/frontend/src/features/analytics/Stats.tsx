import { BarChart3, CheckCircle2, Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AnalyticsStats } from "./hooks/use-analytics";

interface StatsProps {
  stats: AnalyticsStats;
}

export const Stats = ({ stats }: StatsProps) => {
  const { totalCompletions, currentStreak, goalFrequency } = stats;
  const { t } = useTranslation("analytics");

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard
        title={t("stat_total_completions")}
        value={totalCompletions}
        icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
      />
      <StatCard
        title={t("stat_current_streak")}
        value={currentStreak}
        icon={<Flame className="w-5 h-5 text-orange-500" />}
        trend={currentStreak > 0 ? t("stat_streak_active") : t("stat_streak_none")}
      />
      <StatCard
        title={t("stat_goal_frequency")}
        value={goalFrequency}
        icon={<BarChart3 className="w-5 h-5 text-blue-500" />}
        trend={t("stat_goal_frequency_hint")}
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

export const StatCard = ({ title, value = 0, icon, trend }: StatCardProps) => (
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