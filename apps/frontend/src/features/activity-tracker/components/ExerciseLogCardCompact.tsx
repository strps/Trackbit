import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { useUnitSystem } from '@/providers/unit-system-provider';
import { kgToDisplay, weightUnit } from '@/shared/utils/intlFormatter';
import { useExercises } from '@/hooks/use-exercises';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/shared/components/ui/dropdown-menu';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/components/ui/popover';
import { Info, MoreVertical, Trash2, Clock, Hash, Scale, MapPin, Plus } from 'lucide-react';
import { RPE_LABELS } from '@/shared/components/RpeSelector';
import { OptimisticExercisePerformance } from '@/features/tracker/use-tracker';
import { formatDuration, getAvgRpe, rpeColor } from '../utils';
import { useActivityTracker } from '../api/useActivityTracker';
import { SetEditor } from './SetEditor';
import { FlexibilityHoldCard } from './ExerciseLogCard';
import type { ExerciseLogCardProps } from './ExerciseLogCard';

/**
 * Compact variant of ExerciseLogCard. Instead of one control card per set, the per-set columns
 * in the legend are the selector: tap a set to open a single popover control that edits it.
 * Drop-in for ExerciseLogCard (same props); chosen via the exerciseLogCardStyle preference.
 */
export const ExerciseLogCardCompact = ({ exerciseLog, isSelected, index, setEditing: onEditTrigger }: ExerciseLogCardProps) => {
    const { exercises } = useExercises();
    const { deletePerformance, newPerformance: newSet, updatePerformance: updateSet, removeExerciseLog } = useActivityTracker();
    const { unitSystem } = useUnitSystem();
    const { t } = useTranslation('tracker');
    const unit = weightUnit(unitSystem);
    const exercise = exercises.find(e => e.id === exerciseLog.exerciseId);
    const category = (exercise?.category || 'strength') as 'strength' | 'cardio' | 'flexibility';
    const [openSetId, setOpenSetId] = useState<number | null>(null);
    // Set when the user adds a set, so we auto-open its controls popover. We follow the
    // optimistic set as its temporary negative id is swapped for the server id, then clear.
    const pendingOpenRef = useRef(false);

    const performances = exerciseLog.exercisePerformances;
    const avgRpe = getAvgRpe(performances);

    const handleNewSet = () => {
        pendingOpenRef.current = true;
        newSet({ exerciseLogId: exerciseLog.id });
    };

    useEffect(() => {
        if (!pendingOpenRef.current || performances.length === 0) return;
        const last = performances[performances.length - 1];
        setOpenSetId(last.id);
        onEditTrigger(index);
        // Once the id is server-confirmed (positive), stop following.
        if (last.id > 0) pendingOpenRef.current = false;
    }, [performances, index, onEditTrigger]);

    const handleOpenChange = (perfId: number, open: boolean) => {
        setOpenSetId(open ? perfId : null);
        if (open) onEditTrigger(index);
        else pendingOpenRef.current = false;
    };

    const isCardio = category === 'cardio';
    const setLabel = isCardio ? t('activity_lap') : t('activity_set');

    // -- Per-set trigger column (strength: reps/weight, cardio: time/distance) --
    const renderSetColumn = (perf: OptimisticExercisePerformance, i: number) => {
        const selected = openSetId === perf.id;
        return (
            <Popover key={i} open={selected} onOpenChange={(o) => handleOpenChange(perf.id, o)}>
                <PopoverTrigger asChild>
                    <button
                        className={`flex flex-col gap-1 text-center rounded-md px-2 py-1 transition-colors hover:bg-muted/60 ${selected ? 'bg-primary/10 ring-1 ring-primary' : ''}`}
                    >
                        <span className="text-muted-foreground text-[9px]">{setLabel} {i + 1}</span>
                        {isCardio ? (
                            <>
                                <span>{formatDuration((perf.duration ?? 0) / 1000)}</span>
                                <span>{perf.distance ?? '-'}</span>
                            </>
                        ) : (
                            <>
                                <span>{perf.reps || '-'}</span>
                                <span>{perf.weight != null ? kgToDisplay(perf.weight, unitSystem) : '-'}</span>
                            </>
                        )}
                    </button>
                </PopoverTrigger>
                <PopoverContent align="center" className="w-56 normal-case">
                    <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex flex-col gap-3"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-muted-foreground uppercase">{setLabel} {i + 1}</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => { deletePerformance(perf.id); setOpenSetId(null); }}
                                aria-label={isCardio ? t('activity_delete_selected_lap') : t('activity_delete_selected_set')}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                        <SetEditor performance={perf} index={i} category={category} onUpdate={updateSet} />
                    </motion.div>
                </PopoverContent>
            </Popover>
        );
    };

    const body = category === 'flexibility' ? (
        <FlexibilityHoldCard exerciseLog={exerciseLog} />
    ) : (
        <div className="text-[12px] font-bold text-muted-foreground uppercase">
            <div className="flex items-end gap-x-4">
                <div className="flex flex-col gap-1 items-end pb-1">
                    {isCardio ? (
                        <>
                            <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {t('activity_time')}</div>
                            <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {t('activity_distance_km')}</div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-1"><Hash className="w-3 h-3" /> {t('activity_reps')}</div>
                            <div className="flex items-center gap-1"><Scale className="w-3 h-3" /> {t('activity_weight_unit', { unit })}</div>
                        </>
                    )}
                </div>
                <div className="flex gap-1 text-foreground font-medium overflow-x-auto p-1 -m-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {performances.map(renderSetColumn)}
                    <button
                        onClick={handleNewSet}
                        className="flex flex-col items-center justify-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                        aria-label={isCardio ? t('activity_new_lap') : t('activity_new_set')}
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
                {avgRpe != null && (
                    <div className={`ml-auto flex flex-col items-end normal-case ${rpeColor(avgRpe)}`}>
                        <span className="text-[9px] text-muted-foreground uppercase">{t('activity_avg_rpe')}</span>
                        <span className="text-base font-bold leading-none">{avgRpe}</span>
                        <span className="text-[9px] font-normal italic normal-case opacity-80">{RPE_LABELS[avgRpe]}</span>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className={`rounded-xl border border-border mt-1 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300 ${isSelected ? 'ring-2 ring-primary' : ''}`}>
            <div className="flex border-b justify-between w-full px-6 py-1">
                <div className="flex items-center">
                    <h4 className="font-bold text-sm">
                        {exercise?.name || t('activity_unknown_exercise')}
                    </h4>
                    <Button variant="ghost"><Info /></Button>
                </div>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-lg" className="h-8 w-8 self-start text-muted-foreground hover:text-foreground">
                                <MoreVertical className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onSelect={() => removeExerciseLog(exerciseLog.id)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t('activity_delete_exercise')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <div className="py-4 px-6">
                {body}
            </div>
        </div>
    );
};
