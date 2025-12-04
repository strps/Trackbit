import { Button } from "@/components/ui/button"
import { AlertTriangle, BookOpen, Briefcase, Code, Coffee, Droplet, Dumbbell, Heart, Home, Moon, Music, Plus, Star, Sun, Trash2, XCircle } from "lucide-react"
import { JSX } from "react";
import { ICONS } from "./IconField";

interface HabitListProps {
    habits: Trackbit.Habit[];
    activeHabitId: number | null;
    editHabit: (habit: Trackbit.Habit) => void;
    handleDelete: (id: number, e: React.MouseEvent<HTMLButtonElement>) => void;
    startNewHabit: () => void
}







// Helper to render the actual Lucide icon component dynamically
const renderIcon = (iconId, className = "w-5 h-5") => {
    const iconDef = ICONS.find(i => i.id === iconId) || ICONS[0];
    const IconComponent = iconDef.icon;
    return IconComponent ? <IconComponent className={className} /> : null;
};


export const HabitList = ({ habits, activeHabitId, editHabit, handleDelete, startNewHabit }: HabitListProps) => {

    return (
        <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Your Habits</h2>
                <span className="text-xs font-medium px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300">
                    {habits.length} Active
                </span>
            </div>

            <div className="space-y-3">
                {habits.map(habit => (
                    <div
                        key={habit.id}
                        onClick={() => editHabit(habit)}
                        className={`
                  group p-4 rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden
                  ${activeHabitId === habit.id
                                ? 'bg-white dark:bg-slate-800 border-blue-500 ring-2 ring-blue-500/20 shadow-lg'
                                : 'bg-white dark:bg-slate-800 border-transparent hover:border-slate-300 dark:hover:border-slate-600 shadow-sm hover:shadow-md'}
                `}
                    >
                        <div className="flex items-center gap-4 relative z-10">
                            <div className={`
                    w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm
                    bg-${habit.color}-500
                  `}>
                                {renderIcon(habit.icon, "w-6 h-6")}
                            </div>

                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-lg truncate">{habit.name}</h3>
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    <span className={`px-1.5 py-0.5 rounded capitalize ${habit.type === 'negative' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-slate-100 dark:bg-slate-700'}`}>
                                        {habit.type === 'complex' ? 'Structured' : habit.type === 'negative' ? 'Negative' : 'Simple'}
                                    </span>
                                    <span>•</span>
                                    <span>{habit.type === 'negative' ? 'Limit:' : 'Goal:'} {habit.goal}/wk</span>
                                </div>
                            </div>

                            <Button
                                onClick={(e) => handleDelete(habit.id, e)}
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Decorative background accent */}
                        <div className={`absolute right-0 top-0 w-24 h-full bg-gradient-to-l from-${habit.color}-50 dark:from-${habit.color}-900/10 to-transparent opacity-50 pointer-events-none`} />
                    </div>
                ))}

                <button
                    onClick={startNewHabit}
                    className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400 hover:text-blue-500 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all flex items-center justify-center gap-2 font-medium"
                >
                    <Plus className="w-5 h-5" />
                    Create New Habit
                </button>
            </div>
        </div>
    )
}