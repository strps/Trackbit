import { useState } from 'react';
import { Settings } from 'lucide-react';
import { useHabits } from '@/hooks/use-habits';
import { HabitList } from './HabitsList';
import { HabitConfigForm } from './HabitConfigForm';

const HabitConfig = () => {
    // Mock initial state - in real app, this would come from your database

    const { habits, isLoading, createHabit, updateHabit, deleteHabit } = useHabits();

    const [isEditing, setIsEditing] = useState(false);
    const [activeHabitId, setActiveHabitId] = useState(null); // ID of habit being edited, or null for new

    const defaultForm = {
        name: '',
        description: '',
        type: 'simple',
        colorStops: [
            { position: 0, color: [241, 245, 249] },
            { position: 1, color: [16, 185, 129] },
        ],
        icon: 'star',
        weeklyGoal: 5,
        dailyGoal: 5
    };

    const [formData, setFormData] = useState(defaultForm);

    const startNewHabit = () => {
        setFormData(defaultForm);
        setActiveHabitId(null);
        setIsEditing(true);
    };

    const editHabit = (habit) => {
        setFormData({ ...defaultForm, ...habit });
        setActiveHabitId(habit.id);
        setIsEditing(true);
    };

    const handleDelete = (id, e) => {
        e.stopPropagation();
        if (window.confirm('Delete habit?')) {
            deleteHabit(Number(id));
            if (activeHabitId === id) cancelEdit();
        }
    }

    const cancelEdit = () => {
        setIsEditing(false);
        setActiveHabitId(null);
        setFormData(defaultForm);
    };

    const saveHabit = () => {
        if (!formData.name.trim()) return;

        if (activeHabitId) {
            // Update existing
            updateHabit({
                id: Number(activeHabitId), // Ensure ID types match (string vs number)
                ...formData
            });
        } else {
            // Create new
            createHabit(formData);
        }
        cancelEdit();
    };



    // Helper to render the actual Lucide icon component dynamically


    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center">Loading Habits...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans p-4 md:p-8">
            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Header (Spans full width) */}
                <div className="lg:col-span-12 flex items-center justify-between mb-2">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <Settings className="w-8 h-8 text-slate-400" />
                            Habit Settings
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">Configure your daily routines and tracking preferences.</p>
                    </div>
                </div>

                {/* Left Column: Habit List */}
                <HabitList
                    habits={habits}
                    activeHabitId={activeHabitId}
                    editHabit={editHabit}
                    handleDelete={handleDelete}
                    startNewHabit={startNewHabit}
                />


                {/* Right Column: Configuration Form */}
                <HabitConfigForm
                    isEditing={isEditing}
                    formData={formData}
                    setFormData={setFormData}
                    selectedHabit={habits.find(e => e.id === activeHabitId)}
                />
            </div>
        </div>
    );
};

export default HabitConfig;