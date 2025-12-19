import React, { useState } from 'react';
import {
    Dumbbell, Search, Plus,
    Activity, User, Globe, Check,
    Timer, Hash, Ruler, Scale
} from 'lucide-react';
import { useExercises } from '../hooks/use-exercises';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

// --- Configuration: Define Behavior per Category ---
const CATEGORY_CONFIG = {
    strength: {
        label: 'Strength Training',
        icon: Dumbbell,
        description: 'For lifting and resistance exercises.',
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

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        category: 'strength' as keyof typeof CATEGORY_CONFIG,
        muscleGroup: 'Chest'
    });

    const filteredExercises = exercises.filter(ex => {
        const matchesSearch = ex.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType =
            filterType === 'all' ? true :
                filterType === 'custom' ? !!ex.userId :
                    !ex.userId;
        return matchesSearch && matchesType;
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await createExercise(formData);
        setIsFormOpen(false);
        setFormData({ name: '', category: 'strength', muscleGroup: 'Chest' });
    };

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading Library...</div>;

    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <Dumbbell className="w-8 h-8 text-primary" />
                            Exercise Library
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Manage your database of movements and activities.
                        </p>
                    </div>
                    <Button
                        onClick={() => setIsFormOpen(!isFormOpen)}
                        className="font-bold"
                        size="lg"
                    >
                        {isFormOpen ? 'Cancel' : (
                            <>
                                <Plus className="w-4 h-4 mr-2" /> Add Custom Exercise
                            </>
                        )}
                    </Button>
                </div>

                {/* Add Form (Expanded) */}
                {isFormOpen && (
                    <div className="p-6 bg-card rounded-xl border border-border shadow-sm">
                        <h3 className="font-bold text-lg mb-6">Create New Exercise</h3>
                        <form onSubmit={handleSubmit} className="space-y-6">

                            {/* Name & Target */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase">Exercise Name</Label>
                                    <Input
                                        type="text"
                                        required
                                        placeholder="e.g. Bulgarian Split Squat"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase">Target Muscle</Label>
                                    <select
                                        value={formData.muscleGroup}
                                        onChange={e => setFormData({ ...formData, muscleGroup: e.target.value })}
                                        className="w-full h-10 px-3 rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
                                    >
                                        {MUSCLE_GROUPS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Category Selector (Visual) */}
                            <div className="space-y-3">
                                <Label className="text-xs font-bold uppercase">Tracking Logic</Label>
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
                                                        ? 'border-primary bg-primary/5'
                                                        : 'border-border hover:border-accent'}
                                                `}
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                                        <Icon className="w-5 h-5" />
                                                    </div>
                                                    {isSelected && <Check className="w-5 h-5 text-primary" />}
                                                </div>
                                                <h4 className={`font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                                                    {config.label}
                                                </h4>
                                                <p className="text-xs text-muted-foreground mt-1">{config.description}</p>

                                                <div className="mt-4 pt-3 border-t border-border/50">
                                                    <span className="text-[10px] uppercase font-bold text-muted-foreground mb-2 block">Inputs:</span>
                                                    <div className="flex flex-wrap gap-2">
                                                        {config.fields.map(f => (
                                                            <span key={f.label} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-muted border border-border shadow-sm text-muted-foreground font-medium">
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

                            <Button
                                disabled={isCreating}
                                type="submit"
                                className="w-full"
                            >
                                {isCreating ? 'Saving...' : 'Save to Library'}
                            </Button>
                        </form>
                    </div>
                )}

                {/* Filters & Search */}
                <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-border">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                            type="text"
                            placeholder="Search exercises..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <div className="flex p-1 bg-muted rounded-lg">
                        {(['all', 'custom', 'system'] as const).map((type) => (
                            <Button
                                key={type}
                                onClick={() => setFilterType(type)}
                                variant={filterType === type ? 'default' : 'ghost'}
                                className="capitalize"
                            >
                                {type}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* List Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredExercises.map((exercise) => {
                        const config = CATEGORY_CONFIG[exercise.category as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.strength;

                        return (
                            <div
                                key={exercise.id}
                                className="p-4 bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <Badge variant="secondary" className={config.color}>
                                        {config.label}
                                    </Badge>
                                    {exercise.userId ? (
                                        <Badge variant="outline" className="flex items-center gap-1">
                                            <User className="w-3 h-3" /> Mine
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground">
                                            <Globe className="w-3 h-3" /> System
                                        </Badge>
                                    )}
                                </div>

                                <h3 className="font-bold text-lg mb-1">{exercise.name}</h3>

                                <div className="text-sm text-muted-foreground flex items-center gap-2 mb-3">
                                    <Activity className="w-4 h-4" />
                                    <span>{exercise.muscleGroup || 'General'}</span>
                                </div>

                                <div className="pt-3 border-t border-border flex gap-2">
                                    {config.fields.map(f => (
                                        <Badge key={f.label} variant="outline" className="text-[10px]">
                                            {f.label}
                                        </Badge>
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