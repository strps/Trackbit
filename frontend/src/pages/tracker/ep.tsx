import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useExercises } from "@/hooks/use-exercises";
import { ChevronDown, Dumbbell, MoreVertical, Plus, Trash2, X, Search, GripVertical, Hash, Scale, Info, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SetInputField } from "./SetInputField";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { useTrackerStore } from "./store";
import { useHabitLogs } from "@/hooks/use-habit-logs";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// --- Types ---
interface WorkoutSet {
    exerciseId: number;
    setNumber: number;
    reps: number;
    weight: number;
    weightUnit: string;
}


export const ExerciseSessionPanel = () => {
    const { habitsWithLogs } = useHabitLogs()

    const selectedHabitId = useTrackerStore(state => state.selectedHabitId);
    const selectedDate = useTrackerStore(state => state.selectedDay);

    const dayLog = habitsWithLogs[selectedHabitId!].dayLogs[selectedDate]
    const exerciseSessions = dayLog?.exerciseSessions
    const exerciseLogs = exerciseSessions?.exerciseLogs

    console.log(!dayLog)

    const handleAddSession = () => {

    }

    return (
        <div className="flex flex-col h-full">

            <div className="flex flex-col p-3">
                {(!dayLog || exerciseSessions?.length === 0) ?
                    <div
                        onClick={handleAddSession}
                        className="bg-card text-muted-foreground flex flex-col gap-6 rounded-xl border-4 border-dashed p-6 shadow-lg justify-center items-center cursor-pointer"
                    >
                        <div className="flex flex-col items-center justify-center gap-3">
                            <p>No Session for Today</p>
                            <PlusCircle size={"3em"} />
                            <p>Press here to start a new session</p>
                        </div>
                    </div>
                    :
                    <SessionCard />
                }
            </div>
        </div>
    );
};




const SessionCard = () => {


    return (
        <div className="bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-lg">

            <div className="flex justify-between items-center pb-4 px-4 border-b border-border ">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600">
                        <Dumbbell className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Workout Session</h3>
                        <div className="flex items-center gap-2 h-4">
                            <span className="text-xs text-slate-500">
                                {/* {sets.length} Sets Total */}
                            </span>
                        </div>
                    </div>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreVertical className="w-5 h-5 text-muted-foreground" />
                        </Button>
                    </DropdownMenuTrigger>

                </DropdownMenu>
            </div>


            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                        <Plus className="w-6 h-6 text-slate-300" />
                    </div>
                    <h4 className="font-medium text-slate-900 dark:text-slate-200">Empty Session</h4>
                    <p className="text-xs text-slate-500 mt-1">Add your first exercise to start tracking.</p>
                </div>


            </div>

            <AddExercisePicker onSelect={() => console.log('add exercise')} />


        </div>
    )
}



// --- Sub-Components ---

const ExerciseCard = ({ exerciseId, originalIndices, allSets, onUpdateSet, onRemoveSet, onAddSet }: any) => {
    const { exercises } = useExercises();
    const exercise = exercises.find((e: any) => e.id === exerciseId);

    const handleSetChange = (index: number, field: keyof WorkoutSet, value: any) => {
        onUpdateSet(index, field, value);
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Card Header */}
            <div className="flex justify-between items-baseline px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-slate-300 cursor-grab active:cursor-grabbing" />
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                        {exercise?.name || 'Unknown Exercise'}

                    </h4>
                    {/*TODO: this down should be redered according to the exrcise, tim distance or sets */}
                    <div className="text-[10px] font-bold text-muted-foreground pl-1 uppercase w-36">
                        <span className="inline-flex items-center gap-1 "><Hash className="w-3 h-3" /> Reps /<Scale className="w-3 h-3" /> Weight (kg)</span>
                    </div>
                    <Button variant="ghost">
                        <Info />
                    </Button>

                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                    <MoreVertical className="w-4 h-4" />
                </Button>
            </div>

            {/* Sets List */}
            <div className="p-2 space-y-1">
                {/* Grid Headers */}


                <div className="flex overflow-x-auto space-x-2 pb-2">


                    {originalIndices.map((originalIndex: number, localIndex: number) => {
                        const set = allSets[originalIndex];
                        return (
                            // <div key={originalIndex} className="grid grid-cols-[24px_1fr_1fr_32px] gap-3 items-center group">
                            //     {/* Set Indicator */}
                            //     <div className="flex items-center justify-center text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 h-6 w-6 rounded-md">
                            //         {localIndex + 1}
                            //     </div>

                            //     {/* Inputs */}
                            //     <SetInputField
                            //         value={set.reps}
                            //         onChange={(val: number) => onUpdateSet(originalIndex, 'reps', val)}
                            //         isReps={true}
                            //     />
                            //     <SetInputField
                            //         value={set.weight}
                            //         onChange={(val: number) => onUpdateSet(originalIndex, 'weight', val)}
                            //         isReps={false}
                            //     />

                            //     {/* Actions */}
                            //     <button
                            //         onClick={() => onRemoveSet(originalIndex)}
                            //         className="flex items-center justify-center h-8 w-8 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                            //         tabIndex={-1}
                            //     >
                            //         <Trash2 className="w-4 h-4" />
                            //     </button>
                            // </div>
                            <div key={originalIndex} className="flex-none w-24 bg-white dark:bg-slate-800 p-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 flex flex-col items-center">
                                <div className="flex justify-between items-center w-full mb-2">
                                    <span className="font-bold text-[10px] text-slate-400 uppercase">Set {originalIndex + 1}</span>
                                    <button type="button" className="text-slate-300 hover:text-red-500 disabled:opacity-0 transition-colors">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="flex flex-col gap-1.5 w-full">
                                    <SetInputField value={set.reps} onChange={(val: number) => handleSetChange(originalIndex, 'reps', val)} placeholder="Reps" isReps={true} />
                                    <SetInputField value={set.weight} onChange={(val: number) => handleSetChange(originalIndex, 'weight', val)} placeholder="Weight" isReps={false} />
                                </div>
                            </div>
                        );
                    })}
                    <button type="button" onClick={onAddSet} className="w-20 flex-none w-12 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 text-slate-400 hover:text-blue-500 transition-colors bg-slate-50 dark:bg-slate-800/50" title="Add Set">
                        <Plus className="w-5 h-5" />
                        <span className="text-[10px] font-medium">Add</span>
                    </button>

                </div>

            </div>
        </div>
    );
};



const AddExercisePicker = ({ onSelect }: { onSelect: (id: number) => void }) => {
    const { exercises } = useExercises(); //TODO: add reomended exercises. An ordered list of execises depending of workout program, selected muscular zones, or favorites/most done. for now we use the lis of exerciese as it is
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState()


    const filtered = useMemo(() =>
        exercises.filter((e: any) => e.name.toLowerCase().includes(search.toLowerCase())),
        [exercises, search]);

    return (
        <div className="w-full flex justify-end items-center ">
            <Label className="mr-2">Recomended:</Label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button className="rounded-r-none border border-border w-36">
                        {exercises.length > 0 ? exercises[0].name : "Pick one"}
                        <ChevronDown className="w-4 h-4 ml-2" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[340px] p-0" align="center" sideOffset={16} onOpenAutoFocus={(e) => e.preventDefault()}>
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Find exercise..."
                                className="pl-9 bg-slate-50 dark:bg-slate-900 border-none shadow-none focus-visible:ring-0 h-9"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <ScrollArea className="h-[280px]">
                        <div className="p-1">
                            {filtered.length === 0 ? (
                                <div className="p-8 text-center">
                                    <p className="text-sm text-slate-500">No exercises found.</p>
                                    <Button variant="link" size="sm" className="mt-2 text-blue-600">
                                        + Create "{search}"
                                    </Button>
                                </div>
                            ) : (
                                filtered.map((ex: any) => (
                                    <button
                                        key={ex.id}
                                        onClick={() => {
                                            onSelect(ex.id);
                                            setOpen(false);
                                            setSearch("");
                                        }}
                                        className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left group transition-colors"
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-medium text-slate-700 dark:text-slate-200">{ex.name}</span>
                                            <span className="text-[10px] text-slate-400 uppercase">{ex.muscleGroup || 'General'}</span>
                                        </div>
                                        <Plus className="w-4 h-4 text-slate-300 group-hover:text-blue-500" />
                                    </button>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </PopoverContent>
            </Popover>
            <Button className="rounded-l-none border-l border-y border-border w-36">
                + Add Exercise
            </Button>
        </div>
    );
};






// {/* Header */}
// <div className="flex justify-between items-center p-4 border-b border-border ">
//     <div className="flex items-center gap-3">
//         <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600">
//             <Dumbbell className="w-5 h-5" />
//         </div>
//         <div>
//             <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Workout Session</h3>
//             <div className="flex items-center gap-2 h-4">
//                 <span className="text-xs text-slate-500">
//                     {sets.length} Sets Total
//                 </span>
//                 {/* Status Indicator */}
//                 {status === 'saving' && (
//                     <span className="text-[10px] text-blue-500 animate-pulse font-bold flex items-center gap-1">
//                         <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" /> Saving...
//                     </span>
//                 )}
//                 {status === 'saved' && (
//                     <span className="text-[10px] text-emerald-500 font-bold transition-opacity duration-500">
//                         Saved
//                     </span>
//                 )}
//             </div>
//         </div>
//     </div>
// </div>

// {/* Scrollable List Area */}
// <div className="flex-1 overflow-y-auto p-4 space-y-4">
//     {sets.length === 0 ? (
//         <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
//             <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
//                 <Plus className="w-6 h-6 text-slate-300" />
//             </div>
//             <h4 className="font-medium text-slate-900 dark:text-slate-200">Empty Session</h4>
//             <p className="text-xs text-slate-500 mt-1">Add your first exercise to start tracking.</p>
//         </div>
//     ) : (
//         groupedExercises.map((group, groupIdx) => (
//             <ExerciseCard
//                 key={`${group.exerciseId}-${groupIdx}`} // Unique key for superset support
//                 exerciseId={group.exerciseId}
//                 originalIndices={group.originalIndices}
//                 allSets={sets}
//                 onUpdateSet={handleUpdateSet}
//                 onRemoveSet={handleRemoveSet}
//                 onAddSet={() => handleAddSetToExercise(group.exerciseId)}
//             />
//         ))
//     )}

//     {/* Spacer to ensure last card isn't covered by sticky footer */}
//     <div className="h-16" />
// </div>