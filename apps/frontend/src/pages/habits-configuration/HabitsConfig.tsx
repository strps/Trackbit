import { useState } from 'react';
import { Settings } from 'lucide-react';
import { useHabits } from '@/hooks/use-habits';
import { HabitList } from './HabitsList';
import { HabitConfigForm } from './HabitConfigForm';
import { Habit } from "@trackbit/db";

const HabitConfig = () => {
    const { habits, isLoading, createHabit, updateHabit, deleteHabit } = useHabits();

    const [isEditing, setIsEditing] = useState(false);
    const [activeHabitId, setActiveHabitId] = useState<number | null | undefined>(undefined);

    const startNewHabit = () => {
        setActiveHabitId(null);
        setIsEditing(true);
    };

    const editHabit = (habit: Habit) => {
        setActiveHabitId(habit.id);
        setIsEditing(true);
    };

    const handleDelete = (id: number, e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        if (window.confirm('Delete habit?')) {
            deleteHabit(Number(id));
            if (activeHabitId === id) cancelEdit();
        }
    }

    const cancelEdit = () => {
        setIsEditing(false);
        setActiveHabitId(null);
    };

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center">Loading Habits...</div>;
    }

    return (
        <div className="min-h-screen bg-background text-foreground font-sans p-4 md:p-8">
            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

                <div className="lg:col-span-12 flex items-center justify-between mb-2">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <Settings className="w-8 h-8 text-muted-foreground" />
                            Habit Settings
                        </h1>
                        <p className="text-muted-foreground mt-1">Configure your daily routines and tracking preferences.</p>
                    </div>
                </div>

                <HabitList
                    habits={habits}
                    activeHabitId={activeHabitId}
                    editHabit={editHabit}
                    handleDelete={handleDelete}
                    startNewHabit={startNewHabit}
                />

                <HabitConfigForm
                    isEditing={isEditing}
                    habit={habits.find(e => e.id === activeHabitId)}
                />
            </div>
        </div>
    );
};

export default HabitConfig;