import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { Check, GripVertical, ListChecks, Lock, Plus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useExercises } from '@/hooks/use-exercises';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { toItemInput, type ExerciseListWithItems, type ListItemInput } from './use-exercise-lists';

interface ExerciseListEditorProps {
    list: ExerciseListWithItems | null;
    onSaveItems: (input: { listId: number; items: ListItemInput[] }) => void;
}

// Phase 2 edits order and membership only — prescriptions are deliberately not
// surfaced here. They still round-trip untouched through `toItemInput`, so the
// Phase 4 editor can add the fields without changing the save path.
export const ExerciseListEditor = ({ list, onSaveItems }: ExerciseListEditorProps) => {
    const { t } = useTranslation('lists');
    const { t: tErrors } = useTranslation('errors');
    const { exercises } = useExercises();

    const [search, setSearch] = useState('');
    const [addOpen, setAddOpen] = useState(false);

    const exercisesById = useMemo(
        () => new Map(exercises.map((exercise) => [exercise.id, exercise])),
        [exercises],
    );

    const filtered = useMemo(
        () => exercises.filter((exercise) => exercise.name.toLowerCase().includes(search.toLowerCase())),
        [exercises, search],
    );

    if (!list) {
        return (
            <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center">
                <ListChecks className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t('list.select_prompt')}</p>
            </div>
        );
    }

    const isFrozen = !!list.frozen;

    const save = (items: ListItemInput[]) => onSaveItems({ listId: list.id, items });

    const handleDragEnd = (result: DropResult) => {
        const { source, destination } = result;
        if (!destination || destination.index === source.index) return;

        const items = list.items.map(toItemInput);
        const [moved] = items.splice(source.index, 1);
        items.splice(destination.index, 0, moved);

        save(items);
    };

    const removeItem = (itemId: number) => {
        save(list.items.filter((item) => item.id !== itemId).map(toItemInput));
    };

    const addExercise = (exerciseId: number) => {
        save([...list.items.map(toItemInput), { exerciseId }]);
        setSearch('');
        setAddOpen(false);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold">{list.name}</h2>
                    {list.description && (
                        <p className="truncate text-sm text-muted-foreground">{list.description}</p>
                    )}
                </div>

                <Popover open={addOpen} onOpenChange={setAddOpen}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span>
                                <PopoverTrigger asChild>
                                    <Button size="sm" disabled={isFrozen} className="flex items-center gap-1">
                                        <Plus className="h-4 w-4" />
                                        {t('editor.add_exercise')}
                                    </Button>
                                </PopoverTrigger>
                            </span>
                        </TooltipTrigger>
                        {isFrozen && <TooltipContent>{tErrors('limits.frozen_tooltip')}</TooltipContent>}
                    </Tooltip>

                    <PopoverContent className="w-72 p-0" align="end" onOpenAutoFocus={(e) => e.preventDefault()}>
                        <div className="border-b border-border p-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder={t('editor.search')}
                                    className="bg-background pl-10"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <ScrollArea className="h-72">
                            <div className="flex flex-col gap-1 p-2">
                                {filtered.length === 0 ? (
                                    <p className="py-8 text-center text-sm text-muted-foreground">
                                        {t('editor.no_results')}
                                    </p>
                                ) : (
                                    filtered.map((exercise) => {
                                        const alreadyIn = list.items.some((item) => item.exerciseId === exercise.id);
                                        return (
                                            <button
                                                key={exercise.id}
                                                onClick={() => addExercise(exercise.id)}
                                                className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent"
                                            >
                                                <div className="flex min-w-0 flex-col">
                                                    <span className="truncate font-medium">{exercise.name}</span>
                                                    <span className="text-xs uppercase text-muted-foreground">
                                                        {exercise.category}
                                                    </span>
                                                </div>
                                                {alreadyIn ? (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Check className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                        </TooltipTrigger>
                                                        <TooltipContent>{t('editor.already_added')}</TooltipContent>
                                                    </Tooltip>
                                                ) : (
                                                    <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </ScrollArea>
                    </PopoverContent>
                </Popover>
            </div>

            {isFrozen && (
                <p className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                    <Lock className="h-4 w-4 shrink-0" />
                    {t('editor.frozen_note')}
                </p>
            )}

            <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId={`list-items-${list.id}`}>
                    {(provided, snapshot) => (
                        <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`min-h-24 space-y-2 rounded-xl border-2 border-dashed p-2 transition-all ${snapshot.isDraggingOver ? 'border-primary bg-primary/10' : 'border-border/60 bg-muted/20'
                                }`}
                        >
                            {list.items.length === 0 && (
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                    {t('editor.empty')}
                                </p>
                            )}

                            {list.items.map((item, index) => {
                                const exercise = exercisesById.get(item.exerciseId);

                                return (
                                    <Draggable
                                        key={item.id}
                                        draggableId={String(item.id)}
                                        index={index}
                                        isDragDisabled={isFrozen}
                                    >
                                        {(dragProvided, dragSnapshot) => (
                                            <div
                                                ref={dragProvided.innerRef}
                                                {...dragProvided.draggableProps}
                                                className={`flex items-center gap-3 rounded-lg border border-border bg-card p-3 ${isFrozen ? 'opacity-60 grayscale' : ''
                                                    } ${dragSnapshot.isDragging ? 'shadow-xl' : ''}`}
                                            >
                                                <span
                                                    {...dragProvided.dragHandleProps}
                                                    className={isFrozen ? 'text-muted-foreground/40' : 'cursor-grab text-muted-foreground active:cursor-grabbing'}
                                                    aria-label={t('editor.drag_hint')}
                                                >
                                                    <GripVertical className="h-4 w-4" />
                                                </span>

                                                <span className="w-6 shrink-0 text-xs font-medium text-muted-foreground">
                                                    {index + 1}
                                                </span>

                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate font-medium">{exercise?.name ?? `#${item.exerciseId}`}</p>
                                                    {exercise && (
                                                        <p className="text-xs uppercase text-muted-foreground">
                                                            {exercise.category}
                                                        </p>
                                                    )}
                                                </div>

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 shrink-0"
                                                    disabled={isFrozen}
                                                    aria-label={t('editor.remove')}
                                                    onClick={() => removeItem(item.id)}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </Draggable>
                                );
                            })}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>
        </div>
    );
};
