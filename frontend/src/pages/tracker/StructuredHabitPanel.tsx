import { useState, useMemo } from "react";
import { useExercises } from "@/hooks/use-exercises";
import { ChevronDown, Dumbbell, MoreVertical, Plus, Trash2, X, Search, GripVertical, Hash, Scale, Info, PlusCircle, Divide } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SetInputField } from "./SetInputField";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { OptimisticExerciseSession, OptimisticExerciseSet, useHabitLogs } from "@/hooks/use-habit-logs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { D } from "node_modules/better-auth/dist/index--CrC0_x3.mjs";


export const ExerciseSessionPanel = () => {
    const { createSession, currentDayLog: dayLog, selectedHabitId, selectedDay } = useHabitLogs()
    const exerciseSessions = dayLog?.exerciseSessions


    const handleAddSession = () => {
        createSession()
    }

    return (
        <div className="flex flex-col h-full">

            <div className="flex flex-col p-3">
                {(!dayLog || exerciseSessions?.length === 0 || !exerciseSessions) ?
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

                    exerciseSessions.map((session, i) => <SessionCard key={i} session={session} index={i} />)
                }
            </div>
        </div>
    );
};

interface SessionCardProps {
    session: OptimisticExerciseSession;
    index: number;
}

const SessionCard = ({ session, index }: SessionCardProps) => {
    const { selectedSessionIndex, deleteSession } = useHabitLogs()
    const exerciseLogs = session.exerciseLogs || []
    const isSelected = index === selectedSessionIndex; //TODO: we might use id instead of index.


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
                    <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => deleteSession(session.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>


            <div className="overflow-y-auto px-4 space-y-4">
                {exerciseLogs?.length === 0 || !exerciseLogs ?

                    <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                            <Plus className="w-6 h-6 text-slate-300" />
                        </div>
                        <h4 className="font-medium text-slate-900 dark:text-slate-200">Empty Session</h4>
                        <p className="text-xs text-slate-500 mt-1">Add your first exercise to start tracking.</p>
                    </div>
                    :
                    exerciseLogs.map((exerciseLog, i) => <ExerciseLogCard key={i} exerciseLog={exerciseLog} index={i} />)

                }


                <AddExercisePicker />
            </div>



        </div>
    )
}



// --- Sub-Components ---
interface ExerciseLogCardProps {
    exerciseLog: OptimisticExerciseSet;
    index: number;
}



const ExerciseLogCard = ({ exerciseLog, index }: any) => {
    const { exercises } = useExercises()
    const { deleteSet, newSet, updateSet } = useHabitLogs()
    const exercise = exercises.find(e => e.id === exerciseLog.exerciseId)

    return (
        <div className=" rounded-xl border border-border  shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Card Header */}
            <div className="flex justify-between items-baseline px-4 py-3  border-b border-border">
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
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>

                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                            <MoreVertical className="w-4 h-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Sets List */}
            <div className="p-2 space-y-1">
                {/* Grid Headers */}


                <div className="flex overflow-x-auto space-x-2 pb-2">
                    {
                        exerciseLog.exerciseSets.map((e: OptimisticExerciseSet, i: number) => {
                            return (
                                <div key={i} className="flex flex-col items-center group w-20 border border-border">
                                    <div className="flex justify-between items-center text-xs font-bold w-full p-2">
                                        <span>{/*i+1*/ e.id}</span>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="p-0">
                                                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent side="top">
                                                <DropdownMenuItem onSelect={() => deleteSet(e.id)}>
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    <SetInputField
                                        placeholder="-"
                                        value={e.reps}
                                        onChange={(val: number) => updateSet({ ...e, reps: val })}
                                        isReps={true}
                                    />
                                    <SetInputField
                                        placeholder="-"
                                        value={e.weight}
                                        onChange={(val: number) => updateSet({ ...e, weight: val })}
                                        isReps={false}
                                    />

                                </div>
                            )
                        })

                    }

                    <button
                        onClick={() => { newSet(exerciseLog) }}
                        type="button"
                        title="Add Set"
                        className="flex-none w-20 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 text-slate-400 hover:text-blue-500 transition-colors bg-slate-50 dark:bg-slate-800/50"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="text-[10px] font-medium">Add</span>
                    </button>

                </div>

            </div>
        </div>
    );
};



const AddExercisePicker = () => {
    const { exercises } = useExercises(); //TODO: add reomended exercises. An ordered list of execises depending of workout program, selected muscular zones, or favorites/most done. for now we use the lis of exerciese as it is
    const { addExerciseLog: addExerciseLog } = useHabitLogs()

    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState()

    const handleAddExerciseLog = (exerciseId: number) => {
        addExerciseLog(exerciseId)
    }


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
                                            handleAddExerciseLog(ex.id);
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




