import React, { useState } from 'react';
import {
    Dumbbell, Search, Plus, Filter,
    Activity, User, Globe, Check,
    Timer, Hash, Ruler, Scale
} from 'lucide-react';
import { useExercises } from '../hooks/use-exercises';

// --- Configuration: Define Behavior per Category ---
const CATEGORY_CONFIG = {
    strength: {
        label: 'Strength Training',
        icon: Dumbbell,
        description: 'For lifting and resistance exercises.',
        // These are the fields the user will see when logging
        fields: [
            { label: 'Sets', icon: Hash },
            { label: 'Reps', icon: Activity },
            { label: 'Weight', icon: Scale },
        ],
        color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
    },
    cardio: {
        label: 'Cardio & Endurance',
        icon: Activity,
        description: 'For running, cycling, and stamina.',
        fields: [
            { label: 'Distance', icon: Ruler },
            { label: 'Duration', icon: Timer },
        ],
        color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    },
    flexibility: {
        label: 'Flexibility & Balance',
        icon: User,
        description: 'For yoga, stretching, and mobility.',
        fields: [
            { label: 'Duration', icon: Timer },
        ],
        color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    }
};

const MUSCLE_GROUPS = [
    'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Full Body'
];

const ExerciseLibrary = () => {
    const { exercises, isLoading, createExercise, isCreating } = useExercises();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'custom' | 'system'>('all');

    // Create Form State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        category: 'strength' as keyof typeof CATEGORY_CONFIG,
        muscleGroup: 'Chest'
    });

    // Filter Logic
    const filteredExercises = exercises.filter(ex => {
        const matchesSearch = ex.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType =
            filterType === 'all' ? true :
                filterType === 'custom' ? !!ex.userId :
                    !ex.userId; // System
        return matchesSearch && matchesType;
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await createExercise(formData);
        setIsFormOpen(false);
        setFormData({ name: '', category: 'strength', muscleGroup: 'Chest' });
    };

    if (isLoading) return <div className="p-8 text-center text-slate-500">Loading Library...</div>;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8 font-sans text-slate-900 dark:text-slate-100">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <Dumbbell className="w-8 h-8 text-blue-500" />
                            Exercise Library
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">
                            Manage your database of movements and activities.
                        </p>
                    </div>
                    <button
                        onClick={() => setIsFormOpen(!isFormOpen)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg font-bold hover:opacity-90 transition-opacity"
                    >
                        {isFormOpen ? 'Cancel' : (
                            <>
                                <Plus className="w-4 h-4" /> Add Custom Exercise
                            </>
                        )}
                    </button>
                </div>

                {/* Add Form (Expanded) */}
                {isFormOpen && (
                    <div className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-900 shadow-sm animate-in fade-in slide-in-from-top-2">
                        <h3 className="font-bold text-lg mb-6">Create New Exercise</h3>
                        <form onSubmit={handleSubmit} className="space-y-6">

                            {/* Name & Target */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase text-slate-500">Exercise Name</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Bulgarian Split Squat"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full p-2.5 rounded-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase text-slate-500">Target Muscle</label>
                                    <select
                                        value={formData.muscleGroup}
                                        onChange={e => setFormData({ ...formData, muscleGroup: e.target.value })}
                                        className="w-full p-2.5 rounded-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-700 outline-none"
                                    >
                                        {MUSCLE_GROUPS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Category Selector (Visual) */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold uppercase text-slate-500">Tracking Logic</label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {(Object.entries(CATEGORY_CONFIG) as [keyof typeof CATEGORY_CONFIG, typeof CATEGORY_CONFIG['strength']][]).map(([key, config]) => {
                                        const isSelected = formData.category === key;
                                        const Icon = config.icon;
                                        return (
                                            <div
                                                key={key}
                                                onClick={() => setFormData({ ...formData, category: key })}
                                                className={`
                          cursor-pointer p-4 rounded-xl border-2 transition-all relative overflow-hidden
                          ${isSelected
                                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}
                        `}
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                                                        <Icon className="w-5 h-5" />
                                                    </div>
                                                    {isSelected && <Check className="w-5 h-5 text-blue-500" />}
                                                </div>
                                                <h4 className={`font-bold ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                                    {config.label}
                                                </h4>
                                                <p className="text-xs text-slate-500 mt-1">{config.description}</p>

                                                {/* Data Field Preview */}
                                                <div className="mt-4 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 mb-2 block">Inputs:</span>
                                                    <div className="flex flex-wrap gap-2">
                                                        {config.fields.map(f => (
                                                            <span key={f.label} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm text-slate-600 dark:text-slate-300 font-medium">
                                                                <f.icon className="w-3 h-3" /> {f.label}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <button
                                disabled={isCreating}
                                type="submit"
                                className="w-full py-3 bg-slate-900 dark:bg-blue-600 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-all shadow-md"
                            >
                                {isCreating ? 'Saving...' : 'Save to Library'}
                            </button>
                        </form>
                    </div>
                )}

                {/* Filters & Search */}
                <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search exercises..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex p-1 bg-slate-200 dark:bg-slate-800 rounded-lg">
                        {(['all', 'custom', 'system'] as const).map((type) => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={`
                  px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize
                  ${filterType === type
                                        ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white'
                                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}
                `}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                {/* List Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredExercises.map((exercise) => {
                        // Get the config for visual styling
                        const config = CATEGORY_CONFIG[exercise.category as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.strength;

                        return (
                            <div
                                key={exercise.id}
                                className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow group"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${config.color}`}>
                                        {config.label}
                                    </span>
                                    {exercise.userId ? (
                                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 rounded font-bold uppercase flex items-center gap-1">
                                            <User className="w-3 h-3" /> Mine
                                        </span>
                                    ) : (
                                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500 rounded font-bold uppercase flex items-center gap-1">
                                            <Globe className="w-3 h-3" /> System
                                        </span>
                                    )}
                                </div>

                                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg mb-1">{exercise.name}</h3>

                                <div className="text-sm text-slate-500 flex items-center gap-2 mb-3">
                                    <Activity className="w-4 h-4" />
                                    <span>{exercise.muscleGroup || 'General'}</span>
                                </div>

                                <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex gap-2">
                                    {config.fields.map(f => (
                                        <span key={f.label} className="text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-700">
                                            {f.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

            </div>
        </div>
    );
};

export default ExerciseLibrary;