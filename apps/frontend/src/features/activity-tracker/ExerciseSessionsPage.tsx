import React, { useMemo, useEffect, useState } from 'react';
import {
    Dumbbell,
    MoreVertical, Plus, Trash2, Search, Hash, Scale, Info,
    Play, Pause, SquarePen, Clock, MapPin, ChevronDown
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useExerciseSessions } from './use-exercise-sessions';
import { PerformanceCard, FlexibilityHoldCard, formatDuration } from './StructuredHabitPanel';
import { useExercises } from '@/hooks/use-exercises';
import { OptimisticExerciseSession, OptimisticExercisePerformance, OptimisticExerciseLog } from '@/features/tracker/use-tracker';
import { useSearchParams } from 'react-router-dom';
import { NumericStepper } from '@/shared/components/NumericStepper';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Input } from '@/shared/components/ui/input';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Label } from '@/shared/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/shared/components/ui/dropdown-menu';
import { EmptyState } from '@/shared/components/EmptyState';
import { Timer } from '@/shared/components/Timer';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { Exercise } from '@trackbit/types';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/ui/collapsible';
import { RPE_LABELS } from '@/shared/components/RpeSelector';

// =============================================================================
// Helpers
// =============================================================================

const getAvgRpe = (performances: OptimisticExercisePerformance[]): number | null => {
    const values = performances.map(p => p.rpe).filter((v): v is number => v != null);
    if (values.length === 0) return null;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
};

const rpeColor = (rpe: number) => {
    if (rpe <= 3) return 'text-emerald-500';
    if (rpe <= 6) return 'text-amber-400';
    if (rpe <= 8) return 'text-orange-500';
    return 'text-red-500';
};

// =============================================================================
// Page
// =============================================================================

const ExerciseSessionsPage = () => {
    const [searchParams] = useSearchParams();
    const {
        currentHabit,
        setLogId,
        isLoading,
        createSession,
        currentDayLog: dayLog,
    } = useExerciseSessions();

    // Sync logId from URL → store
    useEffect(() => {
        const paramLogId = searchParams.get('logId');
        if (paramLogId) setLogId(Number(paramLogId));
    }, [searchParams]);

    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground">Loading sessions...</div>;
    }

    if (!currentHabit) {
        return (
            <div className="flex h-screen items-center justify-center flex-col gap-4">
                <div className="p-6 bg-muted rounded-full">
                    <Dumbbell className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">
                    No workout habit selected. Navigate here from the Tracker.
                </p>
            </div>
        );
    }

    const exerciseSessions = dayLog?.exerciseSessions;

    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Dumbbell className="w-8 h-8 text-primary" />
                        {currentHabit.name}
                    </h1>
                </div>

                {/* Session content */}
                {(!dayLog || !exerciseSessions || exerciseSessions.length === 0) ? (
                    <EmptyState
                        onClick={() => createSession({})}
                        title="No Sessions Found"
                        description="Click here to start your first workout session"
                    />
                ) : (
                    <div className="space-y-6">
                        {exerciseSessions.map((session, i) => (
                            <SessionCard key={i} session={session} index={i} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExerciseSessionsPage;

// =============================================================================
// Session Card
// =============================================================================

interface SessionCardProps {
    session: OptimisticExerciseSession;
    index: number;
}

const SessionCard = ({ session, index }: SessionCardProps) => {
    const { deleteSession, addExerciseLog } = useExerciseSessions();
    const exerciseLogs = session.exerciseLogs || [];
    const [selectedExerciseLogIndex, setSelectedExerciseLogIndex] = useState<number | null>(null);

    return (
        <div className="bg-card text-card-foreground flex flex-col item gap-6 py-6 shadow-lg">
            <div className="flex justify-between items-center pb-4 px-4 border-b border-border">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Dumbbell className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm text-foreground">Workout Session</h3>
                        <div className="flex items-center gap-2 h-4">
                            <span className="text-xs text-muted-foreground" />
                        </div>
                    </div>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreVertical className="w-5 h-5 text-muted-foreground" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => deleteSession(session.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="overflow-y-auto px-4 space-y-4">
                {exerciseLogs.length === 0 ? (
                    <EmptyState
                        title="Empty Session"
                        description="Add your first exercise to start tracking."
                    />
                ) : (
                    exerciseLogs.map((exerciseLog, i) => (
                        <ExerciseLogCard
                            key={i}
                            exerciseLog={exerciseLog}
                            index={i}
                            isSelected={i === selectedExerciseLogIndex}
                            setEditing={setSelectedExerciseLogIndex}
                        />
                    ))
                )}

                <div className="flex justify-end">
                    <AddExercisePicker sessionId={session.id} setEditing={() => setSelectedExerciseLogIndex(exerciseLogs.length)} />
                </div>
            </div>
        </div>
    );
};

// =============================================================================
// Exercise Log Card
// =============================================================================

interface ExerciseLogCardProps {
    exerciseLog: OptimisticExerciseLog;
    isSelected: boolean;
    index: number;
    setEditing: (index: number | null) => void;
}

const ExerciseLogCard = ({ exerciseLog, isSelected, index, setEditing: onEditTrigger }: ExerciseLogCardProps) => {
    const { exercises } = useExercises();
    const { deleteSet, newSet, updateSet, removeExerciseLog } = useExerciseSessions();
    const exercise = exercises.find(e => e.id === exerciseLog.exerciseId);
    const [selectedPerformanceId, setSelectedPerformanceId] = useState<number | null>(null);

    const cardContents: any = {
        strength: {
            content: (
                <div className="flex overflow-x-auto gap-2 p-2">
                    {exerciseLog.exercisePerformances.map((e: OptimisticExercisePerformance, i: number) => (
                        <PerformanceCard
                            key={i}
                            category="strength"
                            performance={e}
                            index={i}
                            onUpdate={updateSet}
                            isSelected={selectedPerformanceId === e.id}
                            onHeaderClick={() => setSelectedPerformanceId(e.id)}
                        />
                    ))}
                    <EmptyState
                        description="New Set"
                        onClick={() => newSet({ exerciseLog })}
                        className="w-26 py-0"
                        icon={Play}
                    />
                </div>
            ),
            legend: (() => {
                const avgRpe = getAvgRpe(exerciseLog.exercisePerformances);
                return (
                    <div className="text-[12px] font-bold text-muted-foreground uppercase">
                        <div className="flex items-end gap-x-4">
                            <div className="flex flex-col gap-1 items-end">
                                <div className="flex items-center gap-1"><Hash className="w-3 h-3" /> Reps</div>
                                <div className="flex items-center gap-1"><Scale className="w-3 h-3" /> Weight (kg)</div>
                            </div>
                            <div className="flex gap-2 text-foreground font-medium">
                                {exerciseLog.exercisePerformances.map((_: any, i: number) => (
                                    <div key={i} className="flex flex-col gap-1 text-center">
                                        <span className="text-muted-foreground text-[9px]">Set {i + 1}</span>
                                        <span>{exerciseLog.exercisePerformances[i].reps || '-'}</span>
                                        <span>{exerciseLog.exercisePerformances[i].weight || '-'}</span>
                                    </div>
                                ))}
                            </div>
                            {avgRpe != null && (
                                <div className={`ml-auto flex flex-col items-end normal-case ${rpeColor(avgRpe)}`}>
                                    <span className="text-[9px] text-muted-foreground uppercase">Avg RPE</span>
                                    <span className="text-base font-bold leading-none">{avgRpe}</span>
                                    <span className="text-[9px] font-normal italic normal-case opacity-80">{RPE_LABELS[avgRpe]}</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })(),
        },
        cardio: {
            content: (
                <div className="flex overflow-x-auto gap-2 p-2">
                    {exerciseLog.exercisePerformances.map((e: OptimisticExercisePerformance, i: number) => (
                        <PerformanceCard
                            key={i}
                            category="cardio"
                            performance={e}
                            index={i}
                            onUpdate={updateSet}
                            isSelected={selectedPerformanceId === e.id}
                            onHeaderClick={() => setSelectedPerformanceId(e.id)}
                        />
                    ))}
                    <EmptyState
                        description="New Lap"
                        onClick={() => newSet({ exerciseLog })}
                        className="w-26 py-0"
                        icon={Play}
                    />
                </div>
            ),
            legend: (() => {
                const avgRpe = getAvgRpe(exerciseLog.exercisePerformances);
                return (
                    <div className="text-[12px] font-bold text-muted-foreground uppercase">
                        <div className="flex items-end gap-x-4">
                            <div className="flex flex-col gap-1 items-end">
                                <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> Time</div>
                                <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Distance (km)</div>
                            </div>
                            <div className="flex gap-2 text-foreground font-medium">
                                {exerciseLog.exercisePerformances.map((_: any, i: number) => (
                                    <div key={i} className="flex flex-col gap-1 text-center">
                                        <span className="text-muted-foreground text-[9px]">Lap {i + 1}</span>
                                        <span>{formatDuration(exerciseLog.exercisePerformances[i].duration)}</span>
                                        <span>{exerciseLog.exercisePerformances[i].distance ?? '-'}</span>
                                    </div>
                                ))}
                            </div>
                            {avgRpe != null && (
                                <div className={`ml-auto flex flex-col items-end normal-case ${rpeColor(avgRpe)}`}>
                                    <span className="text-[9px] text-muted-foreground uppercase">Avg RPE</span>
                                    <span className="text-base font-bold leading-none">{avgRpe}</span>
                                    <span className="text-[9px] font-normal italic normal-case opacity-80">{RPE_LABELS[avgRpe]}</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })(),
        },
        flexibility: {
            content: <FlexibilityHoldCard exerciseLog={exerciseLog} />,
            legend: (() => {
                const perf = exerciseLog.exercisePerformances[0];
                const rpe = perf?.rpe ?? null;
                return (
                    <div className="text-[10px] font-bold text-muted-foreground uppercase">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                <span>Duration: {formatDuration(exerciseLog.duration ?? perf?.duration ?? 0)}</span>
                            </div>
                            {rpe != null && (
                                <div className={`flex flex-col items-end normal-case ${rpeColor(rpe)}`}>
                                    <span className="text-[9px] text-muted-foreground uppercase">RPE</span>
                                    <span className="text-base font-bold leading-none">{rpe}</span>
                                    <span className="text-[9px] font-normal italic opacity-80">{RPE_LABELS[rpe]}</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })(),
        },
    };

    return (
        <Collapsible
            open={isSelected}
            className={`rounded-xl border border-border mt-1 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300 ${isSelected && "ring-2 ring-primary"}`}
        >
            <CollapsibleTrigger asChild>
                <div className="gap-y-3 justify-between items-center min-h-21 w-full">
                    <div className="flex border-b justify-between w-full px-6 py-1">
                        <div className="flex items-center">
                            <h4 className="font-bold text-sm">
                                {exercise?.name || 'Unknown Exercise'}
                            </h4>
                            <Button variant="ghost"><Info /></Button>
                        </div>
                        <div className="flex items-center gap-2">
                            {isSelected && (
                                <Button onClick={() => onEditTrigger(null)}>Finish</Button>
                            )}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon-lg" className="h-8 w-8 self-start text-muted-foreground hover:text-foreground">
                                        <MoreVertical className="w-4 h-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    {isSelected ? (
                                        <DropdownMenuItem onSelect={() => onEditTrigger(null)}>
                                            <SquarePen className="mr-2 h-4 w-4" />
                                            Finish Editing
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem onSelect={() => onEditTrigger(index)}>
                                            <SquarePen className="mr-2 h-4 w-4" />
                                            Edit Exercise
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onSelect={() => removeExerciseLog(exerciseLog.id)}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete Exercise
                                    </DropdownMenuItem>
                                    {isSelected && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onSelect={() => selectedPerformanceId && deleteSet(selectedPerformanceId)}
                                                disabled={!selectedPerformanceId}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete Selected {exercise?.category === 'strength' ? 'Set' : exercise?.category === 'cardio' ? 'Lap' : 'Set'}
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                    <div className="py-4 px-6">
                        {cardContents[exercise?.category || 'strength'].legend}
                    </div>
                </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="p-4 border-t border-border -order-1">
                {cardContents[exercise?.category || 'strength'].content}
            </CollapsibleContent>
        </Collapsible>
    );
};

// =============================================================================
// Exercise Picker
// =============================================================================

const AddExercisePicker = ({ sessionId, setEditing }: { sessionId: number; setEditing: () => void }) => {
    const { exercises } = useExercises();
    const { addExerciseLog } = useExerciseSessions();

    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(0);

    const handleAddExerciseLog = (exerciseId: number) => {
        const exercise = exercises.find((e: any) => e.id === exerciseId);
        console.log(exercise?.lastPerformance)
        addExerciseLog({
            exerciseSessionId: sessionId,
            exerciseId,
            lastPerformance: exercise?.lastPerformance,
        });
        setEditing();
        setOpen(false);
        setSearch('');
    };

    const filtered = useMemo(
        () => exercises.filter((e: any) => e.name.toLowerCase().includes(search.toLowerCase())),
        [exercises, search],
    );

    return (
        <div className="w-min flex items-stretch rounded-l-xl rounded-r-[3rem] border-2 border-primary bg-card p-4 shadow-sm">
            <div className="flex items-center gap-4">
                <div className="flex flex-col gap-2">
                    <Label className="text-xs text-muted-foreground ml-2">Recommended:</Label>
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-48 justify-between">
                                <span className="truncate">
                                    {exercises.length > 0 ? exercises[selected].name : 'Select exercise'}
                                </span>
                                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-0" align="start" sideOffset={5} onOpenAutoFocus={(e) => e.preventDefault()}>
                            <div className="border-b border-border p-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search exercises..."
                                        className="pl-10 bg-background"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <ScrollArea className="h-72">
                                <div className="p-2 flex flex-col gap-1">
                                    {filtered.length === 0 ? (
                                        <div className="py-8 text-center">
                                            <p className="text-sm text-muted-foreground">No exercises found.</p>
                                            <Button variant="link" size="sm" className="mt-2">
                                                + Create "{search}"
                                            </Button>
                                        </div>
                                    ) : (
                                        filtered.map((ex: Exercise) => {
                                            const isTheSelected = ex.id === exercises[selected].id;
                                            return (
                                                <button
                                                    key={ex.id}
                                                    onClick={() => {
                                                        handleAddExerciseLog(ex.id);
                                                        if (isTheSelected) setSelected((prev) => (prev + 1) % exercises.length);
                                                    }}
                                                    className={`w-full flex items-center justify-between rounded-md px-3 py-2.5 text-left text-sm hover:bg-accent transition-colors ${isTheSelected && 'ring ring-primary'}`}
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{ex.name}</span>
                                                        <span className="text-xs text-muted-foreground uppercase">{ex.category}</span>
                                                    </div>
                                                    <Plus className="h-4 w-4 text-muted-foreground transition-opacity" />
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </ScrollArea>
                        </PopoverContent>
                    </Popover>
                </div>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            onClick={() => {
                                handleAddExerciseLog(exercises[selected].id);
                                setSelected((prev) => (prev + 1) % exercises.length);
                            }}
                            className="flex justify-center items-center w-15 h-15 rounded-full aspect-square"
                        >
                            <Play className="w-full" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Add Recommended Exercise</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
};
