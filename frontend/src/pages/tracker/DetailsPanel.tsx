import { useExercises } from "@/hooks/use-exercises";
import { CalendarSearch, ChevronDown, Dumbbell, Hash, Minus, Plus, Save, Scale, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { SetInputField } from "./SetInputField";


interface WorkoutSet {
    exerciseId: number;
    setNumber: number;
    reps: number;
    weight: number;
    weightUnit: string;
}

interface DetailsPanelProps {
    selectedDay: string | null;
    setSelectedDay: (day: string | null) => void;
    activeHabit: Trackbit.Habit;
    logsMap: Record<string, number>;
    logSimple: any;
    logWorkout: (data: { habitId: string; date: string; sets: any[] }) => void;
    logs: any[];
}

export function DayLog({ selectedDay, setSelectedDay, activeHabit, logsMap, logSimple, logWorkout, logs }: DetailsPanelProps) {
    return (

        (selectedDay && activeHabit) ?
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                {activeHabit.type === 'complex' ? (
                    <ExerciseSessionPanel
                        dateStr={selectedDay}
                        habitId={activeHabit.id}
                        logs={logs}
                        onSaveLog={logWorkout}
                        onClose={() => setSelectedDay(null)}
                    />
                ) : (
                    <SimpleHabitPanel
                        dateStr={selectedDay}
                        value={logsMap[selectedDay] || 0}
                        color={activeHabit.color}
                        onClose={() => setSelectedDay(null)}
                        updateCount={(val: number) => logSimple({ habitId: activeHabit.id, date: selectedDay, value: val })}
                    />
                )}
            </div>
            : null
    );
}

// Exercise Session Panel (The Vertical Accordion Container) (Restored & Wired)
const ExerciseSessionPanel = ({ dateStr, habitId, logs, onSaveLog, onClose }: any) => {
    const [editingId, setEditingId] = useState<number | 'NEW' | null>(null);
    const { exercises } = useExercises();

    // Find the log entry for the selected day/habit
    const logEntry = logs.find((l: any) => l.habitId === habitId && l.date === dateStr);

    // The sets are directly available on the log entry (JSONB/Sets in Drizzle)
    const logsForDay = logEntry?.sets || [];
    const logId = logEntry?.id;

    // We can only edit one complex log per day for this MVP setup
    const initialData = logEntry;

    // Function to calculate stats for the session summary
    const calculateSummary = (sets: any[]) => {
        if (sets.length === 0) return { totalSets: 0, maxWeight: 0 };
        return {
            totalSets: sets.length,
            maxWeight: Math.max(...sets.map((s: any) => s.weight))
        };
    };

    const summary = calculateSummary(logsForDay);

    // Handle saving the full log entry
    const handleSave = (data: any) => {
        onSaveLog({
            id: logId, // Pass ID if updating
            habitId: habitId,
            date: dateStr,
            sets: data.sets
        });
        setEditingId(null);
    };

    return (
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 rounded-b-xl">
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex flex-col">
                    Session Log
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {new Date(dateStr).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                </h3>
                <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                    <CalendarSearch className="w-5 h-5" />
                </button>
            </div>

            <div className="flex flex-col space-y-3">
                {/* Check if a log entry exists for this day */}
                {logEntry ? (
                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
                        {editingId === logId ? (
                            /* Expanded Edit View */
                            <div className="p-4 bg-slate-50 dark:bg-slate-900/50">
                                <h4 className="font-bold text-sm text-slate-500 mb-4 uppercase tracking-wider">Edit Session</h4>
                                <SessionForm
                                    isNew={false}
                                    initialData={initialData}
                                    onSave={handleSave}
                                    onCancel={() => setEditingId(null)}
                                    // Delete button needs to delete the entire log header
                                    onDelete={() => alert("Deletion needs to be implemented in API.")}
                                    habitId={habitId}
                                    dateStr={dateStr}
                                />
                            </div>
                        ) : (
                            /* Collapsed Summary View */
                            <div
                                onClick={() => setEditingId(logId)}
                                className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                            >
                                <div>
                                    <div className="font-bold text-slate-900 dark:text-slate-100">Workout Summary</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 flex gap-3">
                                        <span className="font-semibold">{summary.totalSets} Sets Logged</span>
                                        {summary.maxWeight > 0 && <span>Max Lift: {summary.maxWeight}kg</span>}
                                    </div>
                                </div>
                                <ChevronDown className="w-5 h-5 text-slate-400" />
                            </div>
                        )}
                    </div>
                ) : editingId === 'NEW' ? (
                    <div className="border border-blue-200 dark:border-blue-900 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 p-4 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                        <h4 className="font-bold text-sm text-blue-600 mb-4 uppercase tracking-wider">New Workout Session</h4>
                        <SessionForm
                            isNew={true}
                            onSave={handleSave}
                            onCancel={() => setEditingId(null)}
                            habitId={habitId}
                            dateStr={dateStr}
                        />
                    </div>
                ) : (
                    <button
                        onClick={() => setEditingId('NEW')}
                        className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-blue-400 text-slate-400 font-medium transition-all flex items-center justify-center gap-2"
                    >
                        <Plus className="w-5 h-5" /> Log First Session
                    </button>
                )}
            </div>

            {logEntry === undefined && editingId !== 'NEW' && (
                <div className="text-center py-8 text-slate-400">
                    <Dumbbell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No complex session logged for this day yet.</p>
                </div>
            )}
        </div>
    );
};

// Simple Habit Panel (Counter) (Restored & Wired)
const SimpleHabitPanel = ({ dateStr, value, color, updateCount, onClose }: any) => {
    return (
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center min-h-[72px] animate-in fade-in slide-in-from-left-4 duration-200 rounded-b-xl">
            <div className="flex flex-col">
                <span className="font-bold text-slate-900 dark:text-slate-100">
                    {new Date(dateStr).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                <span className="text-slate-500 text-xs">
                    {value} completions recorded
                </span>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 bg-white dark:bg-slate-700 rounded-lg p-1 border border-slate-200 dark:border-slate-600 shadow-sm">
                    <button onClick={() => updateCount(Math.max(0, value - 1))} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-600 rounded text-slate-500 hover:text-slate-900 dark:text-slate-300">
                        <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-mono font-bold">{value}</span>
                    <button onClick={() => updateCount(value + 1)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-600 rounded text-slate-500 hover:text-slate-900 dark:text-slate-300">
                        <Plus className="w-3 h-3" />
                    </button>
                </div>
                <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                    <CalendarSearch className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};


const SessionForm = ({ initialData, onSave, onCancel, onDelete, isNew, habitId, dateStr }: any) => {
    const { exercises } = useExercises();

    // Find the primary exercise ID from the existing log if editing
    const initialExerciseId = initialData?.sets?.[0]?.exerciseId || exercises[0]?.id || 0;

    const [formData, setFormData] = useState({
        // Note: For simplicity, we assume one exercise per session form entry
        exerciseId: initialExerciseId,
        sets: initialData?.sets || [{ setNumber: 1, reps: 0, weight: 0, weightUnit: 'kg' }],
    });

    useEffect(() => {
        if (formData.exerciseId === 0 && exercises.length > 0) {
            setFormData(prev => ({ ...prev, exerciseId: exercises[0].id }));
        }
    }, [exercises, formData.exerciseId]);


    const handleSetChange = (index: number, field: keyof WorkoutSet, value: any) => {
        const newSets = [...formData.sets];
        newSets[index] = { ...newSets[index], [field]: value };
        setFormData({ ...formData, sets: newSets });
    };

    const addSet = () => {
        const lastSet = formData.sets[formData.sets.length - 1];
        setFormData({
            ...formData,
            sets: [...formData.sets, {
                setNumber: formData.sets.length + 1,
                reps: lastSet.reps,
                weight: lastSet.weight,
                weightUnit: lastSet.weightUnit
            }]
        });
    };

    const removeSet = (index: number) => {
        if (formData.sets.length > 1) {
            setFormData({
                ...formData,
                sets: formData.sets.filter((_, i) => i !== index)
            });
        }
    };

    const handleSubmit = () => {
        // Filter out empty sets and prepare for API
        const finalSets = formData.sets
            .filter(s => s.reps > 0 || s.weight > 0)
            .map(s => ({ ...s, exerciseId: Number(formData.exerciseId) }));

        if (finalSets.length === 0) {
            alert("Please log at least one set with reps or weight.");
            return;
        }

        onSave({
            id: initialData?.id, // Pass ID if updating
            habitId: habitId,
            date: dateStr,
            sets: finalSets
        });
        onCancel();
    };

    return (
        <div className="space-y-4">
            {/* Exercise Selector */}
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Exercise</label>
                <select
                    value={formData.exerciseId}
                    onChange={(e) => setFormData({ ...formData, exerciseId: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    autoFocus
                >
                    {exercises.length === 0 && <option value="0">Loading Exercises...</option>}
                    {exercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                </select>
            </div>

            {/* Sets & Reps Section */}
            <div className="space-y-3 mt-2">
                <div className="flex justify-start text-[10px] font-bold text-slate-400 pl-1 uppercase tracking-wider">
                    <span className="inline-flex items-center gap-1 mr-4"><Hash className="w-3 h-3 text-blue-500" /> Reps</span>
                    <span className="inline-flex items-center gap-1"><Scale className="w-3 h-3 text-slate-500" /> Weight (kg)</span>
                </div>

                <div className="flex overflow-x-auto space-x-2 pb-2">
                    {formData.sets.map((set, index: number) => (
                        <div key={index} className="flex-none w-24 bg-white dark:bg-slate-800 p-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 flex flex-col items-center">
                            <div className="flex justify-between items-center w-full mb-2">
                                <span className="font-bold text-[10px] text-slate-400 uppercase">Set {index + 1}</span>
                                <button type="button" onClick={() => removeSet(index)} disabled={formData.sets.length === 1} className="text-slate-300 hover:text-red-500 disabled:opacity-0 transition-colors">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                            <div className="flex flex-col gap-1.5 w-full">
                                <SetInputField value={set.reps} onChange={(val: number) => handleSetChange(index, 'reps', val)} placeholder="Reps" isReps={true} />
                                <SetInputField value={set.weight} onChange={(val: number) => handleSetChange(index, 'weight', val)} placeholder="Weight" isReps={false} />
                            </div>
                        </div>
                    ))}

                    <button type="button" onClick={addSet} className="flex-none w-12 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 text-slate-400 hover:text-blue-500 transition-colors bg-slate-50 dark:bg-slate-800/50" title="Add Set">
                        <Plus className="w-5 h-5" />
                        <span className="text-[10px] font-medium">Add</span>
                    </button>
                </div>
            </div>

            <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleSubmit} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm">
                    <Save className="w-4 h-4" /> {isNew ? 'Log Session' : 'Save Changes'}
                </button>
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors">
                    Cancel
                </button>
                {/* Delete button only shows up on edit view */}
                {!isNew && (
                    <button type="button" onClick={onDelete} className="px-4 py-2 rounded-lg font-medium text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-colors" title="Delete Session">
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
};
