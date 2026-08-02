import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { GripVertical, ListChecks, Lock, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import type { ExerciseListWithItems } from './use-exercise-lists';

interface ExerciseListRailProps {
    lists: ExerciseListWithItems[];
    selectedId: number | null;
    onSelect: (id: number) => void;
    onCreate: () => void;
    onRename: (list: ExerciseListWithItems) => void;
    onDelete: (list: ExerciseListWithItems) => void;
    onReorder: (orderedIds: number[]) => void;
    atCap: boolean;
    maxLists: number | null;
}

export const ExerciseListRail = ({
    lists,
    selectedId,
    onSelect,
    onCreate,
    onRename,
    onDelete,
    onReorder,
    atCap,
    maxLists,
}: ExerciseListRailProps) => {
    const { t } = useTranslation('lists');
    const { t: tErrors } = useTranslation('errors');

    const handleDragEnd = (result: DropResult) => {
        const { source, destination } = result;
        if (!destination || destination.index === source.index) return;

        const ordered = lists.map((list) => list.id);
        const [moved] = ordered.splice(source.index, 1);
        ordered.splice(destination.index, 0, moved);

        onReorder(ordered);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{t('list.heading')}</h2>
                <div className="flex items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                        {lists.length}
                    </span>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span>
                                <Button size="sm" onClick={onCreate} disabled={atCap} className="flex items-center gap-1">
                                    <Plus className="h-4 w-4" />
                                    {t('list.new')}
                                </Button>
                            </span>
                        </TooltipTrigger>
                        {atCap && (
                            <TooltipContent>
                                {tErrors('limits.exercise_list_limit_reached_body', {
                                    maxExerciseLists: maxLists ?? 0,
                                })}
                            </TooltipContent>
                        )}
                    </Tooltip>
                </div>
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="exercise-lists">
                    {(provided, snapshot) => (
                        <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`min-h-24 space-y-2 rounded-xl border-2 border-dashed p-2 transition-all ${snapshot.isDraggingOver
                                ? 'border-primary bg-primary/10'
                                : 'border-border/60 bg-muted/20'
                                }`}
                        >
                            {lists.length === 0 && !snapshot.isDraggingOver && (
                                <div className="py-8 text-center">
                                    <ListChecks className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                                    <p className="font-medium">{t('list.empty_title')}</p>
                                    <p className="text-sm text-muted-foreground">{t('list.empty_desc')}</p>
                                </div>
                            )}

                            {lists.map((list, index) => {
                                const isFrozen = !!list.frozen;
                                const isSelected = list.id === selectedId;

                                return (
                                    <Draggable
                                        key={list.id}
                                        draggableId={String(list.id)}
                                        index={index}
                                        isDragDisabled={isFrozen}
                                    >
                                        {(dragProvided, dragSnapshot) => (
                                            <div
                                                ref={dragProvided.innerRef}
                                                {...dragProvided.draggableProps}
                                                onClick={() => onSelect(list.id)}
                                                className={`flex items-center gap-2 rounded-xl border bg-card p-3 transition-all ${isSelected ? 'border-primary ring-2 ring-primary/40' : 'border-border'
                                                    } ${isFrozen ? 'opacity-60 grayscale' : 'cursor-pointer hover:bg-accent/40'} ${dragSnapshot.isDragging ? 'shadow-xl' : ''
                                                    }`}
                                            >
                                                <span
                                                    {...dragProvided.dragHandleProps}
                                                    className={isFrozen ? 'text-muted-foreground/40' : 'cursor-grab text-muted-foreground active:cursor-grabbing'}
                                                    aria-label={t('editor.drag_hint')}
                                                >
                                                    <GripVertical className="h-4 w-4" />
                                                </span>

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="truncate font-semibold">{list.name}</h3>
                                                        {isFrozen && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Badge variant="outline" className="flex items-center gap-1 text-xs">
                                                                        <Lock className="h-3 w-3" />
                                                                        {tErrors('limits.frozen_badge')}
                                                                    </Badge>
                                                                </TooltipTrigger>
                                                                <TooltipContent>{tErrors('limits.frozen_tooltip')}</TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        {t('list.items_count', { count: list.items.length })}
                                                    </p>
                                                </div>

                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 shrink-0"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                                        {!isFrozen && (
                                                            <DropdownMenuItem onClick={() => onRename(list)}>
                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                {t('list.rename')}
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive"
                                                            onClick={() => onDelete(list)}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            {t('list.delete')}
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
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
