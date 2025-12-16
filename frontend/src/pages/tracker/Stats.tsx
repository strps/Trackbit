import { BarChart3, CheckCircle2, Flame, Trophy } from "lucide-react";


export const Stats = () => {

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
                title="Total Completions"
                value={0}
                icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}

            />
            <StatCard
                title="Current Streak"
                icon={<Flame className="w-5 h-5 text-orange-500" />}
                trend="Keep the fire burning"
            />
            <StatCard
                title="Goal Frequency"
                icon={<BarChart3 className="w-5 h-5 text-blue-500" />}
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

export const StatCard = ({ title, value, icon, trend }: StatCardProps) => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">{title}</span>
            <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                {icon}
            </div>
        </div>
        <div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{trend}</p>
        </div>
    </div>
);
