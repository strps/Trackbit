import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Layers, Play, Plus, Search } from 'lucide-react';
import type { Exercise, ExerciseSourceDescriptor, QueueEmptyReason } from '@trackbit/types';
import { useExercises } from '@/hooks/use-exercises';
import { useExerciseQueue } from '@/hooks/use-exercise-queue';
import { usePreferredExerciseSource } from '@/hooks/use-preferred-exercise-source';
import { Button } from '@/shared/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Input } from '@/shared/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/components/ui/popover';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/components/ui/tooltip';
import { AddToListMenu } from '@/features/exercise-lists/AddToListMenu';
import { useActivityTracker } from '../api/useActivityTracker';

// Why the queue is empty, in the source's own words. Programs contribute the
// rest_day / no_routine_scheduled cases in Phase 4 without touching this file.
const EMPTY_REASON_KEYS: Record<QueueEmptyReason, string> = {
    rest_day: 'activity_source_empty_rest_day',
    no_routine_scheduled: 'activity_source_empty_no_routine',
    list_empty: 'activity_source_empty_list',
    no_data: 'activity_source_empty_no_data',
};

export const ExercisePicker = ({ sessionId, setEditing }: { sessionId: number; setEditing: () => void }) => {
    const { t } = useTranslation('tracker');
    const { exercises } = useExercises();
    const { addExerciseLog, sessions } = useActivityTracker();
    const { sources, descriptor, activeSource, selectSource } = usePreferredExerciseSource();

    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    // Only used in browse mode — see `browseSelection` below.
    const [browsePickId, setBrowsePickId] = useState<number | null>(null);

    const sessionLogs = sessions.find((s) => s.id === sessionId)?.exerciseLogs ?? [];
    const { entries, done, cursor, nextEntry, emptyReason, isDangling } = useExerciseQueue(
        activeSource,
        sessionLogs,
    );

    // Browse mode: no source, or one that no longer resolves. Everything below
    // branches on this rather than on a source kind — that is the whole point of
    // the abstraction, and it is also what removes the old `exercises[selected]`
    // dereference that crashed on an empty catalog.
    const browsing = activeSource === null || isDangling;

    // Names come from the client's own exercise cache: the queue carries ids so
    // the payload never duplicates (or staleness-skews) the catalog.
    const exerciseById = useMemo(
        () => new Map(exercises.map((e) => [e.id, e] as const)),
        [exercises],
    );

    // System-named sources (Phase 4's "today's routine") carry a key instead of a
    // name; user-authored names are content and are never translated. The cast is
    // the seam — the key set is only known at runtime.
    const nameOf = (source: ExerciseSourceDescriptor): string =>
        source.name ?? (source.nameKey ? (t as (key: string) => string)(source.nameKey) : '');

    const matchesSearch = (exercise: Exercise | undefined) =>
        !!exercise && exercise.name.toLowerCase().includes(search.toLowerCase());

    const queueRows = useMemo(
        () =>
            entries
                .map((entry, index) => ({ entry, index, exercise: exerciseById.get(entry.exerciseId) }))
                .filter((row) => matchesSearch(row.exercise)),
        [entries, exerciseById, search],
    );

    // Searching never traps the user inside the source: the catalog is always
    // reachable, just visually separated and only once a search narrows it.
    const catalogRows = useMemo(() => {
        if (browsing) return exercises.filter(matchesSearch);
        if (search.trim() === '') return [];
        const inQueue = new Set(entries.map((entry) => entry.exerciseId));
        return exercises.filter((e) => matchesSearch(e) && !inQueue.has(e.id));
    }, [browsing, exercises, entries, search]);

    const logExercise = (exerciseId: number, listItemId: number | null) => {
        addExerciseLog({ exerciseSessionId: sessionId, exerciseId, listItemId });
        // In browse mode the trigger *is* the selection, so it follows whatever
        // was just picked. With a source active the selection is the cursor and
        // stays derived from the logs — picking out of order only moves it on.
        if (browsing) setBrowsePickId(exerciseId);
        setEditing();
        setOpen(false);
        setSearch('');
    };

    const nextExercise = nextEntry ? exerciseById.get(nextEntry.exerciseId) : undefined;

    // Browse mode has no queue, so the trigger carries the selection itself: the
    // last exercise picked, falling back to the last one logged so a resumed
    // session finds Play already armed. This is what keeps Play — the quick
    // "add another" control — meaningful outside a source.
    const lastLoggedId = sessionLogs.length > 0 ? sessionLogs[sessionLogs.length - 1].exerciseId : null;
    const browseSelection = browsePickId ?? lastLoggedId;

    const selectedExercise = browsing
        ? (browseSelection !== null ? exerciseById.get(browseSelection) : undefined)
        : nextExercise;
    const sourceLabel = descriptor && !isDangling ? nameOf(descriptor) : t('activity_all_exercises');

    const triggerLabel = selectedExercise?.name ?? t('activity_select_exercise');

    return (
        <div className="w-min flex items-stretch rounded-l-xl rounded-r-[3rem] border-2 border-primary bg-card p-4 shadow-sm">
            <div className="flex items-center gap-4">
                <div className="flex flex-col gap-2">
                    {/* Source dropdown. "All exercises" is browse mode, not a source —
                        it is the absence of one, which is why it sits above the list
                        rather than inside it. */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-fit gap-1 px-2 text-xs text-muted-foreground"
                            >
                                <Layers className="h-3 w-3" />
                                <span className="max-w-36 truncate">{sourceLabel}</span>
                                <ChevronDown className="h-3 w-3 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                            <DropdownMenuLabel className="text-muted-foreground">
                                {t('activity_source')}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />

                            <DropdownMenuItem onSelect={() => selectSource(null)}>
                                <Check className={`mr-2 h-4 w-4 ${browsing ? '' : 'opacity-0'}`} />
                                {t('activity_all_exercises')}
                            </DropdownMenuItem>

                            {sources.map((source) => (
                                <DropdownMenuItem
                                    key={source.key}
                                    onSelect={() => selectSource(source.ref)}
                                >
                                    <Check
                                        className={`mr-2 h-4 w-4 ${
                                            !browsing && descriptor?.key === source.key ? '' : 'opacity-0'
                                        }`}
                                    />
                                    <span className="truncate">{nameOf(source)}</span>
                                    {source.itemCount !== null && (
                                        <span className="ml-auto pl-2 text-xs text-muted-foreground">
                                            {source.itemCount}
                                        </span>
                                    )}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-48 justify-between">
                                <span className="truncate">{triggerLabel}</span>
                                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            className="w-72 p-0"
                            align="start"
                            sideOffset={5}
                            onOpenAutoFocus={(e) => e.preventDefault()}
                            // The add-to-list menu portals to the body, so clicking it
                            // reads as an interaction outside this popover and would
                            // otherwise close the exercise list out from under it.
                            onPointerDownOutside={(e) => {
                                const target = e.detail.originalEvent.target as HTMLElement | null;
                                if (target?.closest('[data-radix-menu-content]')) e.preventDefault();
                            }}
                        >
                            <div className="border-b border-border p-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder={t('activity_search_exercises')}
                                        className="pl-10 bg-background"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                            <ScrollArea className="h-72">
                                <div className="p-2 flex flex-col gap-1">
                                    {/* An empty source states why it is empty instead of
                                        rendering a control that does nothing. */}
                                    {!browsing && entries.length === 0 && (
                                        <p className="py-8 text-center text-sm text-muted-foreground">
                                            {t(EMPTY_REASON_KEYS[emptyReason ?? 'no_data'] as 'activity_source_empty_no_data')}
                                        </p>
                                    )}

                                    {!browsing && queueRows.length > 0 && (
                                        <p className="px-2 py-1 text-xs font-medium uppercase text-muted-foreground">
                                            {sourceLabel}
                                        </p>
                                    )}

                                    {queueRows.map(({ entry, index, exercise }) => (
                                        <ExerciseRow
                                            key={entry.listItemId ?? `${entry.exerciseId}-${entry.position}`}
                                            exercise={exercise!}
                                            highlighted={index === cursor}
                                            done={done[index]}
                                            onSelect={() => logExercise(entry.exerciseId, entry.listItemId)}
                                        />
                                    ))}

                                    {!browsing && catalogRows.length > 0 && (
                                        <p className="mt-2 border-t border-border px-2 pb-1 pt-3 text-xs font-medium uppercase text-muted-foreground">
                                            {t('activity_all_exercises')}
                                        </p>
                                    )}

                                    {catalogRows.map((exercise) => (
                                        <ExerciseRow
                                            key={exercise.id}
                                            exercise={exercise}
                                            onSelect={() => logExercise(exercise.id, null)}
                                        />
                                    ))}

                                    {queueRows.length === 0 && catalogRows.length === 0 && (browsing || entries.length > 0) && (
                                        <div className="py-8 text-center">
                                            <p className="text-sm text-muted-foreground">{t('activity_no_exercises_found')}</p>
                                            <Button variant="link" size="sm" className="mt-2">
                                                {t('activity_create_exercise', { name: search })}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* The quick-add: it always logs whatever the trigger names. With a
                    source that is the cursor entry, so repeated presses walk the
                    queue; in browse mode it repeats the current pick. Absent rather
                    than disabled when there is nothing selected yet. */}
                {selectedExercise && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                onClick={() =>
                                    nextEntry
                                        ? logExercise(nextEntry.exerciseId, nextEntry.listItemId)
                                        : logExercise(selectedExercise.id, null)
                                }
                                className="flex justify-center items-center w-15 h-15 rounded-full aspect-square"
                            >
                                <Play className="w-full" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>
                                {browsing
                                    ? t('activity_add_selected', { name: selectedExercise.name })
                                    : t('activity_add_next_from', { name: sourceLabel })}
                            </p>
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>
        </div>
    );
};

interface ExerciseRowProps {
    exercise: Exercise;
    highlighted?: boolean;
    done?: boolean;
    onSelect: () => void;
}

const ExerciseRow = ({ exercise, highlighted = false, done = false, onSelect }: ExerciseRowProps) => (
    <div
        className={`flex w-full items-center rounded-md pr-1 hover:bg-accent transition-colors ${
            highlighted ? 'ring ring-primary' : ''
        } ${done ? 'opacity-50' : ''}`}
    >
        <button
            onClick={onSelect}
            className="flex min-w-0 flex-1 items-center justify-between px-3 py-2.5 text-left text-sm"
        >
            <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{exercise.name}</span>
                <span className="text-xs text-muted-foreground uppercase">{exercise.category}</span>
            </div>
            {done ? (
                <Check className="h-4 w-4 text-muted-foreground" />
            ) : (
                <Plus className="h-4 w-4 text-muted-foreground transition-opacity" />
            )}
        </button>
        <AddToListMenu exerciseId={exercise.id} />
    </div>
);
