import { useState } from 'react';
import { Settings, X } from 'lucide-react';
import { useHabits } from './use-habits';
import { HabitList } from './HabitsList';
import { HabitConfigForm } from './HabitConfigForm';
import { useLimits } from '@/hooks/use-limits';
import { Habit } from "@trackbit/types";
import { Button } from "@/shared/components/ui/button";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
    DrawerClose,
} from "@/shared/components/ui/drawer";

const HabitConfig = () => {
    const { habits, isLoading, createHabit, updateHabit, deleteHabit, reorderHabits } = useHabits();
    const { atHabitCap, effective } = useLimits();

    const [isEditing, setIsEditing] = useState(false);
    const [activeHabitId, setActiveHabitId] = useState<number | null | undefined>(undefined);

    const startNewHabit = () => {
        if (atHabitCap) return;
        setActiveHabitId(null);
        setIsEditing(true);
    };

    const editHabit = (habit: Habit) => {
        setActiveHabitId(habit.id);
        setIsEditing(true);
    };

    const handleDelete = (id: number) => {
        deleteHabit(Number(id));
        if (activeHabitId === id) cancelEdit();
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
                    onReorder={reorderHabits}
                    atHabitCap={atHabitCap}
                    maxHabits={effective?.maxHabits ?? null}
                />

                <Drawer direction="right" open={isEditing} onOpenChange={(open) => !open && cancelEdit()}>
                    <DrawerContent className="overflow-y-auto">
                        <DrawerHeader className="flex flex-row items-start justify-between">
                            <div className="flex flex-col gap-0.5">
                                <DrawerTitle className="text-xl">
                                    {activeHabitId ? 'Edit Habit' : 'New Habit'}
                                </DrawerTitle>
                                <DrawerDescription>
                                    Define how you want to track this routine.
                                </DrawerDescription>
                            </div>
                            <DrawerClose asChild>
                                <Button variant="ghost" size="icon">
                                    <X className="w-5 h-5" />
                                </Button>
                            </DrawerClose>
                        </DrawerHeader>
                        <HabitConfigForm
                            habit={habits.find(e => e.id === activeHabitId)}
                            onDelete={handleDelete}
                            onCancel={cancelEdit}
                        />
                    </DrawerContent>
                </Drawer>
            </div>
        </div>
    );
};

export default HabitConfig;