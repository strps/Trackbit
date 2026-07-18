import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Plus, Pencil, ShieldAlert, Lock } from "lucide-react"
import { ICONS } from "./IconField";
import { GRADIENT_PRESETS } from "./ColorThemeField";
import { mapValueToColor } from "@/shared/utils/colorUtils";
import { Badge } from "@/shared/components/ui/badge";
import { BigButton } from "@/shared/components/BigButton";
import { Button } from "@/shared/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/shared/components/ui/tooltip";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import type { Habit } from "@trackbit/types";
import { useTranslation } from "react-i18next";

const getColorAtOne = (habit: Habit) => {
    const stops = habit.colorTheme === 'custom' ? habit.colorStops : GRADIENT_PRESETS[habit.colorTheme]?.stops ?? habit.colorStops;
    const [r, g, b] = mapValueToColor(1, 0, 1, stops);
    return `rgb(${r}, ${g}, ${b})`;
};

interface HabitListProps {
    habits: Habit[];
    activeHabitId?: number | null;
    editHabit: (habit: Habit) => void;
    handleDelete: (id: number) => void;
    startNewHabit: () => void;
    onReorder: (items: { id: number; order: number; isAntiHabit: boolean }[]) => void;
    atHabitCap?: boolean;
    maxHabits?: number | null;
}

const renderIcon = (iconId: string, className = "w-5 h-5") => {
    const iconDef = ICONS.find(i => i.id === iconId) || ICONS[0];
    const IconComponent = iconDef.icon;
    return IconComponent ? <IconComponent className={className} /> : null;
};

export const HabitList = ({ habits, activeHabitId, editHabit, startNewHabit, onReorder, atHabitCap, maxHabits }: HabitListProps) => {
    const { t } = useTranslation('habits');
    const { t: tErrors } = useTranslation('errors');

    // Local mirror of the server order. React Query v4 defers observer
    // notifications to a microtask, so an optimistic cache write repaints one
    // frame late — after @hello-pangea/dnd has already committed the drop against
    // the old order, which is the reorder flash. Updating this state synchronously
    // (flushSync) on drop keeps the DOM correct before dnd paints; it re-syncs from
    // props so React Query stays the source of truth (incl. error rollback).
    const [items, setItems] = useState<Habit[]>(habits);
    useEffect(() => { setItems(habits); }, [habits]);

    const positiveHabits = items
        .filter(h => !h.isAntiHabit)
        .sort((a, b) => a.order - b.order);

    const antiHabits = items
        .filter(h => h.isAntiHabit)
        .sort((a, b) => a.order - b.order);

    const handleDragEnd = (result: DropResult) => {
        const { source, destination, draggableId } = result;
        if (!destination) return;

        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        const habitId = Number(draggableId);
        const draggedHabit = items.find(h => h.id === habitId);
        if (!draggedHabit) return;

        if (destination.droppableId === "anti-habits" && draggedHabit.type === "complex") {
            toast.error(t('list.error.structured_anti'), {
                description: t('list.error.anti_restriction'),
            });
            return;
        }

        const sourceList = source.droppableId === "habits" ? [...positiveHabits] : [...antiHabits];
        const isSameList = source.droppableId === destination.droppableId;
        const destList = isSameList
            ? sourceList
            : destination.droppableId === "habits" ? [...positiveHabits] : [...antiHabits];

        const [moved] = sourceList.splice(source.index, 1);
        destList.splice(destination.index, 0, moved);

        const finalPositive = destination.droppableId === "habits" ? destList :
            source.droppableId === "habits" ? sourceList : [...positiveHabits];

        const finalAnti = destination.droppableId === "anti-habits" ? destList :
            source.droppableId === "anti-habits" ? sourceList : [...antiHabits];

        const reorderItems: { id: number; order: number; isAntiHabit: boolean }[] = [];

        finalPositive.forEach((h, i) => {
            reorderItems.push({ id: h.id, order: i, isAntiHabit: false });
        });

        finalAnti.forEach((h, i) => {
            reorderItems.push({ id: h.id, order: i, isAntiHabit: true });
        });

        // Apply the new order to local state synchronously so the DOM reflects it
        // before dnd paints its drop animation — otherwise the list flashes back to
        // the old order for a frame. React Query is updated (and rolled back on
        // error) via onReorder below; the props effect keeps this state in sync.
        const itemMap = new Map(reorderItems.map(i => [i.id, i]));
        flushSync(() => {
            setItems(prev => prev.map(h => {
                const update = itemMap.get(h.id);
                return update ? { ...h, order: update.order, isAntiHabit: update.isAntiHabit } : h;
            }));
        });

        onReorder(reorderItems);
    };

    const badgeLabel = (type: Habit['type']) => {
        if (type === 'complex') return t('list.badge.structured');
        if (type === 'timed') return t('list.badge.timed');
        if (type === 'check') return t('list.badge.check');
        return t('list.badge.count');
    };

    const renderHabitCard = (habit: Habit, index: number) => {
        const isFrozen = !!habit.frozen;
        return (
            <Draggable draggableId={String(habit.id)} index={index} key={habit.id} isDragDisabled={isFrozen}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className="mb-3"
                    >
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div>
                                    <BigButton
                                        isSelected={activeHabitId === habit.id}
                                        className={`w-full ${isFrozen ? 'cursor-default opacity-60 grayscale' : 'cursor-grab active:cursor-grabbing'} ${snapshot.isDragging ? 'shadow-xl ring-2 ring-primary/50' : ''}`}
                                    >
                                        <div className="flex items-center gap-4 flex-1 relative z-10">
                                            <div
                                                className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm shrink-0 relative"
                                                style={{ backgroundColor: getColorAtOne(habit) }}
                                            >
                                                {renderIcon(habit.icon, "w-6 h-6")}
                                                {isFrozen && (
                                                    <span className="absolute -top-1 -right-1 bg-background border rounded-full p-0.5">
                                                        <Lock className="w-3 h-3" />
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-lg truncate flex items-center gap-2">
                                                    {habit.name}
                                                    {isFrozen && (
                                                        <Badge variant="outline" className="text-xs">{tErrors('limits.frozen_badge')}</Badge>
                                                    )}
                                                </h3>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Badge variant="secondary">{badgeLabel(habit.type)}</Badge>
                                                    <span>•</span>
                                                    <span>{habit.isAntiHabit ? t('list.daily_limit') : t('list.daily_goal')} {habit.dailyGoal}{t('list.per_day')}</span>
                                                    <span>•</span>
                                                    <span>{habit.isAntiHabit ? t('list.weekly_limit') : t('list.weekly_goal')} {habit.weeklyGoal}{t('list.per_week')}</span>
                                                </div>
                                            </div>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="shrink-0 self-center"
                                                disabled={isFrozen}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (isFrozen) return;
                                                    editHabit(habit);
                                                }}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </BigButton>
                                </div>
                            </TooltipTrigger>
                            {isFrozen && (
                                <TooltipContent>{tErrors('limits.frozen_tooltip')}</TooltipContent>
                            )}
                        </Tooltip>
                    </div>
                )}
            </Draggable>
        );
    };

    return (
        <div className="lg:col-span-12 space-y-6">
            <DragDropContext onDragEnd={handleDragEnd}>
                {/* Habits Group */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-foreground">{t('list.habits')}</h2>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium px-2 py-1 bg-muted rounded-full text-muted-foreground">
                                {positiveHabits.length}
                            </span>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span>
                                        <Button
                                            onClick={startNewHabit}
                                            size="sm"
                                            disabled={!!atHabitCap}
                                            className="flex items-center gap-1"
                                        >
                                            <Plus className="w-4 h-4" />
                                            {t('list.add')}
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                {atHabitCap && (
                                    <TooltipContent>
                                        {tErrors('limits.habit_limit_reached_body', { maxHabits: maxHabits ?? 0 })}
                                    </TooltipContent>
                                )}
                            </Tooltip>
                        </div>
                    </div>

                    <Droppable droppableId="habits">
                        {(provided, snapshot) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`min-h-16 rounded-xl border-2 border-dashed transition-all duration-200 p-2 ${snapshot.isDraggingOver
                                    ? 'border-primary bg-primary/10 shadow-inner'
                                    : 'border-border/60 bg-muted/20'
                                    }`}
                            >
                                {positiveHabits.length === 0 && !snapshot.isDraggingOver && (
                                    <p className="text-sm text-muted-foreground text-center py-5">
                                        {t('list.empty')}
                                    </p>
                                )}
                                {snapshot.isDraggingOver && positiveHabits.length === 0 && (
                                    <p className="text-sm text-primary font-medium text-center py-5">
                                        {t('list.drop_here_habits')}
                                    </p>
                                )}
                                {positiveHabits.map((habit, index) => renderHabitCard(habit, index))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>

                </div>

                {/* Anti-Habits Group */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-destructive flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5" />
                            {t('list.anti_habits')}
                        </h2>
                        <span className="text-xs font-medium px-2 py-1 bg-destructive/10 rounded-full text-destructive">
                            {antiHabits.length}
                        </span>
                    </div>

                    <Droppable droppableId="anti-habits">
                        {(provided, snapshot) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`min-h-16 rounded-xl border-2 border-dashed transition-all duration-200 p-2 ${snapshot.isDraggingOver
                                    ? 'border-destructive bg-destructive/10 shadow-inner'
                                    : 'border-destructive/30 bg-destructive/5'
                                    }`}
                            >
                                {antiHabits.length === 0 && (
                                    <p className={`text-sm text-center py-5 transition-colors ${snapshot.isDraggingOver ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                        {snapshot.isDraggingOver
                                            ? t('list.drop_here_anti')
                                            : t('list.drag_to_anti')}
                                    </p>
                                )}
                                {antiHabits.map((habit, index) => renderHabitCard(habit, index))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </div>
            </DragDropContext>
        </div>
    );
};
