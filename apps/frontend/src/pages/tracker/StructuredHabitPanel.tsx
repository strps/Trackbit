import React, { useState, useMemo } from "react";
import { useExercises } from "@/hooks/use-exercises";
import { ChevronDown, Dumbbell, MoreVertical, Plus, Trash2, X, Search, GripVertical, Hash, Scale, Info, PlusCircle, Divide } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumericStepper } from "../../components/NumericStepper";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { OptimisticExerciseSession, OptimisticExerciseSet, useTracker } from "@/hooks/use-tracker";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/EmptyState";


export const ExerciseSessionPanel = () => {
    const { createSession, currentDayLog: dayLog, selectedHabitId, selectedDay } = useTracker()
    const exerciseSessions = dayLog?.exerciseSessions


    const handleAddSession = () => {
        createSession()
    }

    return (
        <div className="flex flex-col h-full">

            <div className="flex flex-col p-3">
                {(!dayLog || exerciseSessions?.length === 0 || !exerciseSessions) ?
                    // <div
                    //     onClick={handleAddSession}
                    //     className="bg-card text-muted-foreground flex flex-col gap-6 rounded-xl border-4 border-dashed p-6 shadow-lg justify-center items-center cursor-pointer"
                    // >
                    //     <div className="flex flex-col items-center justify-center gap-3">
                    //         <p>No Session found Today</p>
                    //         <PlusCircle size={"3em"} />
                    //         <p>Press here to start a new session</p>
                    //     </div>
                    // </div>
                    <EmptyState
                        onClick={handleAddSession}
                        title="No Sessions Today"
                        description="Click here to start your first workout session"
                    />
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
    const { selectedSessionIndex, deleteSession } = useTracker()
    const exerciseLogs = session.exerciseLogs || []
    const isSelected = index === selectedSessionIndex; //TODO: we might use id instead of index.


    return (
        <div className="bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-lg">

            <div className="flex justify-between items-center pb-4 px-4 border-b border-border ">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Dumbbell className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm text-foreground">Workout Session</h3>
                        <div className="flex items-center gap-2 h-4">
                            <span className="text-xs text-muted-foreground">
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

                    <EmptyState
                        title="Empty Session"
                        description="Add your first exercise to start tracking."
                    />
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
    const { deleteSet, newSet, updateSet, removeExerciseLog } = useTracker()
    const exercise = exercises.find(e => e.id === exerciseLog.exerciseId)

    return (
        <div className=" rounded-xl border border-border  shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Card Header */}
            <div className="flex justify-between items-baseline px-4 py-3  border-b border-border">
                <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                    <h4 className="font-bold text-sm text-foreground">
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

                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                            <MoreVertical className="w-4 h-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem
                            onSelect={() => removeExerciseLog(exerciseLog.id)}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Sets List */}
            <div className="flex  overflow-x-scroll gap-2 p-2">

                {
                    exerciseLog.exerciseSets.map((e: OptimisticExerciseSet, i: number) => {
                        return (

                            <SetCard
                                key={i}
                                e={e}
                                i={i}
                                deleteSet={deleteSet}
                                updateSet={updateSet}
                            />
                        )
                    })

                }
                <EmptyState
                    description="New Set"
                    onClick={() => { newSet(exerciseLog) }}
                    className="w-26 py-0"
                />



            </div>
        </div>
    );
};



const AddExercisePicker = () => {
    const { exercises } = useExercises(); //TODO: add reomended exercises. An ordered list of execises depending of workout program, selected muscular zones, or favorites/most done. for now we use the lis of exerciese as it is
    const { addExerciseLog } = useTracker()

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
                <PopoverContent className="w-85 p-0" align="center" sideOffset={16} onOpenAutoFocus={(e) => e.preventDefault()}>
                    <div className="p-3 border-b border-border">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Find exercise..."
                                className="pl-9 bg-muted border-none shadow-none focus-visible:ring-0 h-9"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <ScrollArea className="h-70">
                        <div className="p-1">
                            {filtered.length === 0 ? (
                                <div className="p-8 text-center">
                                    <p className="text-sm text-muted-foreground">No exercises found.</p>
                                    <Button variant="link" size="sm" className="mt-2 text-primary">
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
                                        className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-accent text-left group transition-colors"
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-medium text-foreground">{ex.name}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase">{ex.muscleGroup || 'General'}</span>
                                        </div>
                                        <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
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

interface SetCardProps {
    e: OptimisticExerciseSet;
    i: number;
    deleteSet: (id: OptimisticExerciseSet["id"]) => void;
    updateSet: (set: OptimisticExerciseSet) => void;
}

export const SetCard = ({ e, i, deleteSet, updateSet }: SetCardProps) => {
    return (
        <div className="flex flex-col shrink-0 items-center group w-26 border border-border rounded-lg overflow-hidden bg-card">
            <div className="flex justify-between items-center text-xs font-bold w-full p-2 bg-muted/30">
                <span className="text-muted-foreground">Set {i + 1}</span>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="link" size="icon" className="h-6 w-6 p-0 bg-muted/0 hover:bg-muted transition-colors">
                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                            <span className="sr-only">Set options</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="end">
                        <DropdownMenuItem
                            onSelect={() => deleteSet(e.id)}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="flex flex-col w-full">
                <NumericStepper
                    value={e.reps ?? null}
                    onChange={(val) => updateSet({ ...e, reps: val })}
                    placeholder="—"
                    step={1}
                    min={0}
                    aria-label={`Reps for set ${i + 1}`}
                />

                <NumericStepper
                    value={e.weight ?? null}
                    onChange={(val) => updateSet({ ...e, weight: val })}
                    placeholder="—"
                    step={2.5}
                    min={0}
                    aria-label={`Weight for set ${i + 1}`}
                />
            </div>
        </div>
    );
};