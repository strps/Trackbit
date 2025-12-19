import { Plus } from "lucide-react"
import { ICONS } from "./IconField";
import { mapValueToCSSrgb } from "@/lib/colorUtils";
import { Badge } from "@/components/ui/badge";
import { BigButton } from "@/components/BigButton";
import { Habit } from "trackbit-types";

interface HabitListProps {
    habits: Habit[];
    activeHabitId?: number | null;
    editHabit: (habit: Habit) => void;
    handleDelete: (id: number, e: React.MouseEvent<HTMLButtonElement>) => void;
    startNewHabit: () => void
}

const renderIcon = (iconId: string, className = "w-5 h-5") => {
    const iconDef = ICONS.find(i => i.id === iconId) || ICONS[0];
    const IconComponent = iconDef.icon;
    return IconComponent ? <IconComponent className={className} /> : null;
};

export const HabitList = ({ habits, activeHabitId, editHabit, startNewHabit }: HabitListProps) => {
    return (
        <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Your Habits</h2>
                <span className="text-xs font-medium px-2 py-1 bg-muted rounded-full text-muted-foreground">
                    {habits.length} Active
                </span>
            </div>

            <div className="grid grid-cols-1 gap-4 items-stretch auto-rows-fr">
                {habits.map(habit => (
                    <BigButton
                        key={habit.id}
                        onClick={() => editHabit(habit)}
                        isSelected={activeHabitId === habit.id}
                        className="w-full cursor-pointer"
                    >
                        <div className="flex items-center gap-4 relative z-10">
                            <div
                                className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
                                style={{
                                    backgroundColor: mapValueToCSSrgb(1, 0, 1, habit.colorStops)
                                }}
                            >
                                {renderIcon(habit.icon, "w-6 h-6")}
                            </div>

                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-lg truncate">{habit.name}</h3>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Badge variant="secondary">
                                        {habit.type === 'complex' ? 'Structured' : habit.type === 'negative' ? 'Negative' : 'Simple'}
                                    </Badge>
                                    <span>•</span>
                                    <span>{`Daily ${habit.type === 'negative' ? 'Limit:' : 'Goal:'}`} {habit.weeklyGoal}/d</span>
                                    <span>•</span>
                                    <span>{`Weekly ${habit.type === 'negative' ? 'Limit:' : 'Goal:'}`} {habit.weeklyGoal}/w</span>
                                </div>
                            </div>
                        </div>
                    </BigButton>
                ))}

                <BigButton
                    onClick={startNewHabit}
                    isSelected={activeHabitId === null}
                    className="flex items-center cursor-pointer border-4 border-dashed border-border"
                >
                    <Plus className="w-5 h-5" />
                    Create New Habit
                </BigButton>
            </div>
        </div>
    )
}