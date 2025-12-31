import React, { useState } from 'react';
import {
    Dumbbell, Search, Plus,
    Activity, User, Globe, Check,
    Timer, Hash, Ruler, Scale
} from 'lucide-react';
import { useExercises } from '../hooks/use-exercises';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChoiceListField, SelectListOptionComponentProps, SelectOption } from '@/components/Fields/ChoiceListField';
import { TextField } from '@/components/Fields/TextField';
import { TextAreaField } from '@/components/Fields/TextAreaField';

const ExerciseLibrary = () => {
    const { exercises, isLoading } = useExercises();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'custom' | 'system'>('all');

    const [isFormOpen, setIsFormOpen] = useState(false);

    const filteredExercises = exercises.filter(ex => {
        const matchesSearch = ex.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType =
            filterType === 'all' ? true :
                filterType === 'custom' ? !!ex.userId :
                    !ex.userId;
        return matchesSearch && matchesType;
    });



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
                {isFormOpen && <CreateExerciseForm />}

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
                        const config = CATEGORY_CONFIG.find(c => c.value === exercise.category) || CATEGORY_CONFIG[0];

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
                                    <span>
                                        {(exercise as any).muscleGroups?.length > 0
                                            ? (exercise as any).muscleGroups.join(', ')
                                            : exercise.muscleGroup || 'General'}
                                    </span>
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







// --- Configuration: Define Behavior per Category ---
type ExerciseCategoryOption = {
    value: string;
    label: string;
    icon: React.FC<any>;
    description: string;
    fields: { label: string; icon: React.FC<any> }[];
    color: string;
}

const CATEGORY_CONFIG: SelectOption<ExerciseCategoryOption>[] = [
    {
        value: "strength",
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
    {
        value: "cardio",
        label: 'Cardio & Endurance',
        icon: Activity,
        description: 'For running, cycling, and stamina.',
        fields: [
            { label: 'Laps', icon: Hash },
            { label: 'Distance', icon: Ruler },
            { label: 'Duration', icon: Timer },
        ],
        color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    },
    {
        value: "flexibility",
        label: 'Flexibility & Balance',
        icon: User,
        description: 'For yoga, stretching, and mobility.',
        fields: [
            { label: 'Duration', icon: Timer },
        ],
        color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    }
]

const createExerciseSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().max(500, 'Description is too long').optional(),
    category: z.enum(['strength', 'cardio', 'flexibility']),
    muscleGroups: z.array(z.number()),

});

const CreateExerciseForm = () => {

    const { createExercise, isCreating, muscleGroups } = useExercises();


    const form = useForm({
        defaultValues: {
            name: '',
            category: 'strength',
            muscleGroups: [],
            description: ''
        },
        resolver: zodResolver(createExerciseSchema)
    });

    const handleSubmit = (data: z.infer<typeof createExerciseSchema>) => {
        console.log(data);
        createExercise(data);
    };

    const options = muscleGroups.map(m => ({ value: m.id, label: m.name }));


    return (
        <div className="p-6 bg-card rounded-xl border border-border shadow-sm">
            <h3 className="font-bold text-lg mb-6">Create New Exercise</h3>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">

                {/* Name & Target */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className='flex flex-col gap-4'>

                        <TextField
                            name="name"
                            label="Exercise Name"
                            placeholder="e.g. Bulgarian Split Squat"
                            form={form}
                        />
                        <TextAreaField
                            name="description"
                            label="Description"
                            placeholder="Exercise Description"
                            form={form}
                        />
                    </div>


                    <ChoiceListField
                        form={form}
                        name='muscleGroups'
                        label='Target Muscles'
                        options={options}
                        mode='multi'
                        className='flex flex-wrap gap-2'
                        optionComponent={({ value, label, isSelected, onToggle, disabled, number }) => {
                            const className = `
                                                        cursor-pointer px-3 py-2 rounded-md border text-sm font-medium transition-all
                                                        ${isSelected
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background hover:bg-accent hover:text-accent-foreground border-input'}
                                                    `
                            return (
                                <div
                                    key={value}
                                    onClick={() => onToggle(value)}
                                    className={className}
                                >
                                    {label}
                                </div>
                            )
                        }}
                    />



                </div>

                <ChoiceListField
                    form={form}
                    name='category'
                    label='Category'
                    options={CATEGORY_CONFIG}
                    className='grid grid-cols-1 md:grid-cols-2 gap-6'
                    optionComponent={({ value, label, isSelected, onToggle, disabled, icon: Icon, fields, ...props }: SelectListOptionComponentProps<ExerciseCategoryOption>) => {
                        return (
                            <div
                                onClick={() => onToggle(value)}
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
                                    {label}
                                </h4>

                                <p className="text-xs text-muted-foreground mt-1">{props.description}</p>

                                <div className="mt-4 pt-3 border-t border-border/50">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground mb-2 block">Inputs:</span>
                                    <div className="flex flex-wrap gap-2">
                                        {fields.map((f: any) => (
                                            <span key={f.label} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-muted border border-border shadow-sm text-muted-foreground font-medium">
                                                <f.icon className="w-3 h-3" /> {f.label}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )
                    }}
                />


                <Button
                    // disabled={isCreating}
                    type="submit"
                    className="w-full"
                >
                    {isCreating ? 'Saving...' : 'Save to Library'}
                </Button>
            </form>
        </div>
    );
}

export default ExerciseLibrary;