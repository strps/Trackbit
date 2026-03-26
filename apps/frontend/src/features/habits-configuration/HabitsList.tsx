import { useState } from "react";
import { Plus, GripVertical, ShieldAlert, Trash2 } from "lucide-react"
import { ICONS } from "./IconField";
import { GRADIENT_PRESETS } from "./ColorThemeField";
import { mapValueToColor } from "@/shared/utils/colorUtils";
import { Badge } from "@/shared/components/ui/badge";
import { BigButton } from "@/shared/components/BigButton";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import type { Habit } from "@trackbit/types";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";

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
}

const renderIcon = (iconId: string, className = "w-5 h-5") => {
    const iconDef = ICONS.find(i => i.id === iconId) || ICONS[0];
    const IconComponent = iconDef.icon;
    return IconComponent ? <IconComponent className={className} /> : null;
};

export const HabitList = ({ habits, activeHabitId, editHabit, handleDelete, startNewHabit, onReorder }: HabitListProps) => {
    const [habitToDelete, setHabitToDelete] = useState<Habit | null>(null);

    const positiveHabits = habits
        .filter(h => !h.isAntiHabit)
        .sort((a, b) => a.order - b.order);

    const antiHabits = habits
        .filter(h => h.isAntiHabit)
        .sort((a, b) => a.order - b.order);

    const handleDragEnd = (result: DropResult) => {
        const { source, destination, draggableId } = result;
        if (!destination) return;

        // Same position, nothing changed
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        const habitId = Number(draggableId);
        const draggedHabit = habits.find(h => h.id === habitId);
        if (!draggedHabit) return;

        // Handle drop on delete zone
        if (destination.droppableId === "delete-zone") {
            setHabitToDelete(draggedHabit);
            return;
        }

        // Block structured sessions (complex) from being dropped into anti-habits
        if (destination.droppableId === "anti-habits" && draggedHabit.type === "complex") {
            toast.error("Structured sessions can't be anti-habits", {
                description: "Only Count, Check, and Timed habits can be marked as anti-habits.",
            });
            return;
        }

        // Build mutable copies of the relevant lists
        const sourceList = source.droppableId === "habits" ? [...positiveHabits] : [...antiHabits];
        const isSameList = source.droppableId === destination.droppableId;
        const destList = isSameList
            ? sourceList
            : destination.droppableId === "habits" ? [...positiveHabits] : [...antiHabits];

        // Remove from source
        const [moved] = sourceList.splice(source.index, 1);

        // Insert at destination
        destList.splice(destination.index, 0, moved);

        // Determine final lists
        const finalPositive = destination.droppableId === "habits" ? destList :
            source.droppableId === "habits" ? sourceList : [...positiveHabits];

        const finalAnti = destination.droppableId === "anti-habits" ? destList :
            source.droppableId === "anti-habits" ? sourceList : [...antiHabits];

        // Build reorder payload
        const reorderItems: { id: number; order: number; isAntiHabit: boolean }[] = [];

        finalPositive.forEach((h, i) => {
            reorderItems.push({ id: h.id, order: i, isAntiHabit: false });
        });

        finalAnti.forEach((h, i) => {
            reorderItems.push({ id: h.id, order: i, isAntiHabit: true });
        });

        onReorder(reorderItems);
    };

    const renderHabitCard = (habit: Habit, index: number) => (
        <Draggable draggableId={String(habit.id)} index={index} key={habit.id}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className="mb-3"
                >
                    <BigButton
                        onClick={() => editHabit(habit)}
                        isSelected={activeHabitId === habit.id}
                        className={`w-full cursor-pointer ${snapshot.isDragging ? 'shadow-xl ring-2 ring-primary/50' : ''}`}
                    >
                        <div
                            {...provided.dragHandleProps}
                            className="flex items-center self-center text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <GripVertical className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-4 flex-1 relative z-10">
                            <div
                                className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm shrink-0"
                                style={{
                                    backgroundColor: getColorAtOne(habit)
                                }}
                            >
                                {renderIcon(habit.icon, "w-6 h-6")}
                            </div>

                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-lg truncate">{habit.name}</h3>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Badge variant="secondary">
                                        {habit.type === 'complex' ? 'Structured' : habit.type === 'timed' ? 'Timed' : habit.type === 'check' ? 'Check' : 'Count'}
                                    </Badge>
                                    <span>•</span>
                                    <span>{`Daily ${habit.isAntiHabit ? 'Limit:' : 'Goal:'}`} {habit.dailyGoal}/d</span>
                                    <span>•</span>
                                    <span>{`Weekly ${habit.isAntiHabit ? 'Limit:' : 'Goal:'}`} {habit.weeklyGoal}/w</span>
                                </div>
                            </div>
                        </div>
                    </BigButton>
                </div>
            )}
        </Draggable>
    );

    return (
        <div className="lg:col-span-5 space-y-6">
            <DragDropContext onDragEnd={handleDragEnd}>
                {/* Habits Group */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-foreground">Habits</h2>
                        <span className="text-xs font-medium px-2 py-1 bg-muted rounded-full text-muted-foreground">
                            {positiveHabits.length}
                        </span>
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
                                        No habits yet — create one below
                                    </p>
                                )}
                                {snapshot.isDraggingOver && positiveHabits.length === 0 && (
                                    <p className="text-sm text-primary font-medium text-center py-5">
                                        Drop here to add to Habits
                                    </p>
                                )}
                                {positiveHabits.map((habit, index) => renderHabitCard(habit, index))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>

                    <BigButton
                        onClick={startNewHabit}
                        isSelected={activeHabitId === null}
                        className="flex items-center cursor-pointer border-4 border-dashed border-border w-full"
                    >
                        <Plus className="w-5 h-5" />
                        Create New Habit
                    </BigButton>
                </div>

                {/* Anti-Habits Group */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-destructive flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5" />
                            Anti-Habits
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
                                    <p className={`text-sm text-center py-5 transition-colors ${snapshot.isDraggingOver ? 'text-destructive font-medium' : 'text-muted-foreground'
                                        }`}>
                                        {snapshot.isDraggingOver
                                            ? 'Drop here to mark as anti-habit'
                                            : 'Drag a habit here to mark it as an anti-habit'}
                                    </p>
                                )}
                                {antiHabits.map((habit, index) => renderHabitCard(habit, index))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </div>

                {/* Delete Drop Zone */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Trash2 className="w-4 h-4 text-destructive/70" />
                        <h2 className="text-sm font-semibold text-destructive/70 uppercase tracking-wide">Delete</h2>
                    </div>
                    <Droppable droppableId="delete-zone">
                        {(provided, snapshot) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 px-4 transition-all duration-200 ${snapshot.isDraggingOver
                                    ? 'border-destructive bg-destructive/15 text-destructive scale-[1.02] shadow-lg shadow-destructive/10'
                                    : 'border-destructive/30 bg-destructive/5 text-destructive/60'
                                    }`}
                            >
                                <Trash2 className={`w-7 h-7 transition-transform duration-200 ${snapshot.isDraggingOver ? 'scale-125' : ''
                                    }`} />
                                <span className="text-sm font-semibold">
                                    {snapshot.isDraggingOver ? 'Release to delete' : 'Drag a habit here to delete it'}
                                </span>
                                <div className="hidden">{provided.placeholder}</div>
                            </div>
                        )}
                    </Droppable>
                </div>
            </DragDropContext>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!habitToDelete} onOpenChange={(open) => !open && setHabitToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete "{habitToDelete?.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this habit and all its tracked data. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={() => {
                                if (habitToDelete) {
                                    handleDelete(habitToDelete.id);
                                    setHabitToDelete(null);
                                }
                            }}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};