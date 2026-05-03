import React, { useState, useRef } from 'react';
import { useExercises } from '@/hooks/use-exercises';
import { PerformanceCard } from './PerformanceCard';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/shared/components/ui/collapsible';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/shared/components/ui/dropdown-menu';
import { Info, MoreVertical, SquarePen, Trash2, Clock, Hash, Scale, MapPin, Play } from 'lucide-react';
import { EmptyState } from '@/shared/components/EmptyState';
import { RPE_LABELS } from '@/shared/components/RpeSelector';
import { OptimisticExerciseLog, OptimisticExercisePerformance } from '@/features/tracker/use-tracker';
import { formatDuration, getAvgRpe, rpeColor } from '../utils';
import { useActivityTracker } from '../api/useActivityTracker';
import { Timer } from '@/shared/components/Timer';
import { RpeSelector } from '@/shared/components/RpeSelector';

export interface ExerciseLogCardProps {
    exerciseLog: OptimisticExerciseLog;
    isSelected: boolean;
    index: number;
    setEditing: (index: number | null) => void;
}

export const ExerciseLogCard = ({ exerciseLog, isSelected, index, setEditing: onEditTrigger }: ExerciseLogCardProps) => {
    const { exercises } = useExercises();
    const { deletePerformance, newPerformance: newSet, updatePerformance: updateSet, removeExerciseLog } = useActivityTracker();
    const exercise = exercises.find(e => e.id === exerciseLog.exerciseId);
    const [selectedPerformanceId, setSelectedPerformanceId] = useState<number | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const prevPerformanceCountRef = useRef(exerciseLog.exercisePerformances.length);

    React.useEffect(() => {
        const currentCount = exerciseLog.exercisePerformances.length;
        if (currentCount > prevPerformanceCountRef.current && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ left: scrollContainerRef.current.scrollWidth, behavior: 'smooth' });
        }
        prevPerformanceCountRef.current = currentCount;
    }, [exerciseLog.exercisePerformances.length]);

    const handleNewSet = () => {
        newSet({ exerciseLogId: exerciseLog.id });
    };

    const cardContents: any = {
        strength: {
            content: (
                <div ref={scrollContainerRef} className="flex overflow-x-auto gap-2 p-2">
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
                        onClick={handleNewSet}
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
                <div ref={scrollContainerRef} className="flex overflow-x-auto gap-2 p-2">
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
                        onClick={handleNewSet}
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
                                        <span>{formatDuration((exerciseLog.exercisePerformances[i].duration ?? 0) / 1000)}</span>
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
                                <span>Duration: {formatDuration((exerciseLog.duration ?? perf?.duration ?? 0) / 1000)}</span>
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
                                                onSelect={() => selectedPerformanceId && deletePerformance(selectedPerformanceId)}
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
// Flexibility Hold Card
// =============================================================================

interface FlexibilityHoldCardProps {
    exerciseLog: OptimisticExerciseLog;
}

export const FlexibilityHoldCard = ({ exerciseLog }: FlexibilityHoldCardProps) => {
    const { updatePerformance: updateSet } = useActivityTracker();
    const performance = exerciseLog.exercisePerformances[0];

    if (!performance) {
        return (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
                No hold recorded yet.
            </div>
        );
    }

    const handleUpdate = (updates: Partial<OptimisticExercisePerformance>) => {
        updateSet({ ...performance, ...updates });
    };

    return (
        <div className="flex flex-col items-center gap-6 py-8 px-4">
            <div className="text-center">
                <p className="text-sm text-muted-foreground">Duration</p>
                <Timer
                    initialMilliseconds={performance.duration ?? 0}
                    showControls={true}
                    onStop={(finalMs) => handleUpdate({ duration: finalMs })}
                />
            </div>
            <div className="flex flex-col items-center gap-3 w-full max-w-xs">
                <RpeSelector
                    label="Perceived Intensity"
                    value={performance.rpe ?? null}
                    onChange={(val) => handleUpdate({ rpe: val })}
                />
            </div>
        </div>
    );
};
