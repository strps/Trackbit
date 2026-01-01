import React, { useState, useMemo, useEffect, use, ReactEventHandler } from "react";
import { useExercises } from "@/hooks/use-exercises";
import { ChevronDown, Dumbbell, MoreVertical, Plus, Trash2, X, Search, GripVertical, Hash, Scale, Info, PlusCircle, Divide, ChevronLeft, Play, Pause, SquarePen, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumericStepper } from "../../components/NumericStepper";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { OptimisticExerciseSession, OptimisticExercisePerformance, useTracker, OptimisticExerciseLog } from "@/hooks/use-tracker";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/EmptyState";
import { is } from "zod/v4/locales";
import { Timer } from "@/components/Timer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Exercise } from "@trackbit/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";


export const ExerciseSessionPanel = () => {
    const { createSession, currentDayLog: dayLog } = useTracker()
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
    // const isSelected = index === selectedSessionIndex; //TODO: we might use id instead of index.

    const [selectedExrciseLogIndex, setSelectedExrciseLogIndex] = useState<number | null>(null)




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
                    exerciseLogs.map((exerciseLog, i) => {
                        const isSelected = i === selectedExrciseLogIndex;

                        return (<ExerciseLogCard key={i} exerciseLog={exerciseLog} index={i} isSelected={isSelected} setEditing={setSelectedExrciseLogIndex} />)
                    })

                }

                <div
                    className="flex justify-end">
                    <AddExercisePicker setEditing={() => setSelectedExrciseLogIndex(exerciseLogs.length)} />
                </div>
            </div>



        </div>
    )
}



// --- Sub-Components ---
interface ExerciseLogCardProps {
    exerciseLog: OptimisticExerciseLog;
    isSelected: boolean;
    index: number;
    setEditing: (index: number | null) => void;
}


//=============================================================================
//-----------------------------ExerciseLogCard---------------------------------
//=============================================================================

/**
 * Formats a duration in seconds to a string.
 * - Less than 1 hour: "mm:ss" (e.g., "5:23")
 * - 1 hour or more: "h:mm:ss" (e.g., "1:05:23")
 * - Handles null/undefined or non-numeric inputs gracefully by returning "-"
 * @param seconds Duration in seconds
 * @returns Formatted string
 */
export const formatDuration = (seconds: number | null | undefined): string => {
    if (seconds == null || isNaN(seconds)) {
        return "-";
    }

    const secs = Math.floor(seconds);
    const minutes = Math.floor(secs / 60);
    const remainingSeconds = secs % 60;

    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}:${remainingMinutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
    }

    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const ExerciseLogCard = ({ exerciseLog, isSelected, index, setEditing: onEditTrigger }: ExerciseLogCardProps) => {
    const { exercises } = useExercises()
    const { deleteSet, newSet, updateSet, removeExerciseLog } = useTracker()
    const exercise = exercises.find(e => e.id === exerciseLog.exerciseId)

    const [selectedPerformanceId, setSelectedPerformanceId] = useState<number | null>(null)

    const cardContents: any = {
        strength: {
            content: <div className="flex overflow-x-auto gap-2 p-2">
                {
                    exerciseLog.exercisePerformances.map((e: OptimisticExercisePerformance, i: number) => {
                        return (
                            <PerformanceCard
                                key={i}
                                category="strength"
                                performance={e}
                                index={i}
                                onUpdate={updateSet}
                                isSelected={selectedPerformanceId === e.id}
                                onHeaderClick={() => setSelectedPerformanceId(e.id)}
                            />
                        )
                    })

                }
                <EmptyState
                    description="New Set"
                    onClick={() => { newSet({ exerciseLog }) }}
                    className="w-26 py-0"
                    icon={Play}
                />
            </div>,
            legend: <div className="text-[12px] font-bold text-muted-foreground uppercase">
                <div className="flex items-end  gap-x-4">
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
                </div>
            </div>
        },
        cardio: {
            content: <div className="flex overflow-x-auto gap-2 p-2">
                {
                    exerciseLog.exercisePerformances.map((e: OptimisticExercisePerformance, i: number) => {
                        return (
                            <PerformanceCard
                                key={i}
                                category="cardio"
                                performance={e}
                                index={i}
                                onUpdate={updateSet}
                                isSelected={selectedPerformanceId === e.id}
                                onHeaderClick={() => setSelectedPerformanceId(e.id)}
                            />
                        )
                    })

                }
                <EmptyState
                    description="New Lap"
                    onClick={() => { newSet({ exerciseLog }) }}
                    className="w-26 py-0"
                    icon={Play}
                />
            </div>,
            legend: <div className="text-[12px] font-bold text-muted-foreground uppercase">
                <div className="flex items-end gap-x-4">
                    <div className="flex flex-col gap-1 items-end">
                        <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> Time</div>
                        <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Distance (km)</div>
                    </div>
                    <div className="grid grid-cols-[repeat(var(--set-count),minmax(40px,1fr))] gap-2 text-foreground font-medium">
                        {exerciseLog.exercisePerformances.map((_: any, i: number) => (
                            <div key={i} className="flex flex-col gap-1 text-center">
                                <span className="text-muted-foreground text-[9px]">Lap {i + 1}</span>
                                <span>{formatDuration(exerciseLog.exercisePerformances[i].duration)}</span> {/* e.g., "5:23" */}
                                <span>{exerciseLog.exercisePerformances[i].distance ?? '-'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        },
        flexibility: {
            content: <FlexibilityHoldCard exerciseLog={exerciseLog} />,
            legend: <div className="text-[10px] font-bold text-muted-foreground uppercase">
                <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>Duration: {formatDuration(exerciseLog.duration ?? exerciseLog.exercisePerformances[0]?.duration ?? 0)}</span>
                </div>
            </div>
        }
    };

    return (
        <Collapsible
            open={isSelected}
            className={`rounded-xl border border-border  shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300 ${isSelected && "ring ring-primary"}`}
        >
            {/* Card Header */}
            <CollapsibleTrigger className="flex justify-between items-center min-h-21 px-4 py-3 w-full">
                {/* <div
                    className="flex justify-between items-baseline px-4 py-3  border-b border-border"
                > */}
                <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-foreground">
                        {exercise?.name || 'Unknown Exercise'}
                    </h4>
                    <Button variant="ghost">
                        <Info />
                    </Button>
                    {cardContents[exercise?.category || 'strength'].legend}
                </div>
                <div className="flex items-center gap-2">
                    {isSelected &&
                        <Button onClick={() => onEditTrigger(null)}>
                            Finish
                        </Button>
                    }
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>

                            <Button variant="ghost" size="icon-lg" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                <MoreVertical className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {isSelected ?
                                <DropdownMenuItem
                                    onSelect={() => onEditTrigger(null)}
                                >
                                    <SquarePen className="mr-2 h-4 w-4" />
                                    Finish Editing
                                </DropdownMenuItem>
                                :
                                <DropdownMenuItem
                                    onSelect={() => onEditTrigger(index)}
                                >
                                    <SquarePen className="mr-2 h-4 w-4" />
                                    Edit Exercise
                                </DropdownMenuItem>

                            }
                            <DropdownMenuItem
                                onSelect={() => removeExerciseLog(exerciseLog.id)}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Exercise
                            </DropdownMenuItem>
                            {isSelected &&
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onSelect={() => selectedPerformanceId && deleteSet(selectedPerformanceId)}
                                        disabled={!selectedPerformanceId}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete Selected {
                                            (exercise?.category == 'strength') ?
                                                "Set" :
                                                exercise?.category == 'cardio' ?
                                                    "Lap"
                                                    :
                                                    "Set"
                                        }
                                    </DropdownMenuItem>
                                </>
                            }
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* </div> */}
            </CollapsibleTrigger>

            <CollapsibleContent className="p-4 border-t border-border">
                {cardContents[exercise?.category || 'strength'].content}
            </CollapsibleContent>

        </Collapsible>
    );
};

//=============================================================================
//-----------------------------Exercise Picker---------------------------------
//=============================================================================

const AddExercisePicker = ({ setEditing }: { setEditing: () => void }) => {
    const { exercises } = useExercises();
    const { addExerciseLog } = useTracker();

    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const [selected, setSelected] = useState(0);


    const handleAddExerciseLog = (exerciseId: number) => {
        addExerciseLog(exerciseId);
        setEditing()
        setOpen(false);
        setSearch("");
    };

    const filtered = useMemo(
        () => exercises.filter((e: any) => e.name.toLowerCase().includes(search.toLowerCase())),
        [exercises, search]
    );

    return (
        <div
            className="w-min flex items-stretch rounded-l-xl rounded-r-[3rem] border-2 border-primary bg-card p-4 shadow-sm"
        >
            <div className="flex items-center gap-4">
                <div className="flex flex-col gap-2">
                    <Label className="text-xs text-muted-foreground ml-2">Recommended:</Label>
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-48 justify-between">
                                <span className="truncate">
                                    {exercises.length > 0 ? exercises[selected].name : "Select exercise"}
                                </span>
                                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-0" align="start" sideOffset={5} onOpenAutoFocus={(e) => e.preventDefault()}>
                            <div className="border-b border-border p-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search exercises..."
                                        className="pl-10 bg-background"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <ScrollArea className="h-72">
                                <div className="p-2 flex flex-col gap-1">
                                    {filtered.length === 0 ? (
                                        <div className="py-8 text-center">
                                            <p className="text-sm text-muted-foreground">No exercises found.</p>
                                            <Button variant="link" size="sm" className="mt-2">
                                                + Create "{search}"
                                            </Button>
                                        </div>
                                    ) : (
                                        filtered.map((ex: Exercise) => {
                                            const isTheSlected = ex.id === exercises[selected].id;
                                            return (
                                                <button
                                                    key={ex.id}
                                                    onClick={() => {
                                                        handleAddExerciseLog(ex.id)
                                                        isTheSlected && setSelected((prev) => (prev + 1) % exercises.length)
                                                    }}
                                                    className={`w-full flex items-center justify-between rounded-md px-3 py-2.5 text-left text-sm hover:bg-accent transition-colors ${isTheSlected && "ring ring-primary"}`}
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{ex.name}</span>
                                                        <span className="text-xs text-muted-foreground uppercase">
                                                            {ex.category}
                                                        </span>
                                                    </div>
                                                    <Plus className="h-4 w-4 text-muted-foreground transition-opacity" />
                                                </button>
                                            )
                                        })
                                    )}
                                </div>
                            </ScrollArea>
                        </PopoverContent>
                    </Popover>
                </div>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            onClick={() => {
                                handleAddExerciseLog(exercises[selected].id);
                                setSelected((prev) => (prev + 1) % exercises.length)
                            }
                            }
                            className="flex justify-center items-center w-15 h-15 rounded-full aspect-square">
                            <Play className="w-full" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Add Recomended Exercise</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
};


//=============================================================================
//------------------------------Exercise Card----------------------------------
//=============================================================================
interface PerformanceCardProps {
    performance: OptimisticExercisePerformance;
    index: number;
    category: "strength" | "cardio" | "flexibility"; // Extend as needed
    isSelected?: boolean;
    onHeaderClick?: () => void;
    onUpdate: (updated: OptimisticExercisePerformance) => void;
}

export const PerformanceCard = ({
    performance,
    index,
    category,
    isSelected = false,
    onHeaderClick,
    onUpdate,
}: PerformanceCardProps) => {
    const [milliseconds, setMilliseconds] = useState(performance.duration ?? 0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);

    useEffect(() => {
        let interval: any;
        if (isTimerRunning) {
            interval = setInterval(() => {
                setMilliseconds((prev) => prev + 100);
            }, 100);
        } else if (!isTimerRunning && milliseconds !== performance.duration) {
            // Timer stopped – persist the current value
            onUpdate({ ...performance, duration: milliseconds });
        }
        return () => interval && clearInterval(interval);
    }, [isTimerRunning, milliseconds, performance, onUpdate]);

    const formatTime = (ms: number) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        const centiseconds = Math.floor((ms % 1000) / 10);
        return (
            <div className="flex items-center gap-1 text-lg font-medium">
                <span>{minutes.toString().padStart(2, "0")}</span>
                <span>:</span>
                <span>{seconds.toString().padStart(2, "0")}</span>
                <span>.</span>
                <span>{centiseconds.toString().padStart(2, "0")}</span>
            </div>
        );
    };

    const headerLabel = category === "cardio" ? "Lap" : "Set";

    return (
        <div
            className={`flex flex-col shrink-0 w-26 items-center border border-border rounded-lg overflow-hidden bg-card ${isSelected ? "ring ring-primary shadow-lg" : ""
                }`}
        >
            {/* Header */}
            <div
                onClick={onHeaderClick}
                className={`flex justify-between items-center w-full h-10 px-2 text-xs font-bold bg-muted/30 ${isSelected ? "bg-primary text-primary-foreground" : ""
                    }`}
            >
                <span className={isSelected ? "text-primary-foreground" : "text-muted-foreground"}>
                    {headerLabel} {index + 1}
                </span>

                {category === "cardio" && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering header click
                            setIsTimerRunning(!isTimerRunning);
                        }}
                        className={isTimerRunning ? "bg-destructive hover:bg-destructive/90" : ""}
                    >
                        {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                )}
            </div>

            {/* Fields */}
            <div className="flex flex-col w-full p-2 gap-3">
                {/* Strength fields */}
                {category === "strength" && (
                    <>
                        <NumericStepper
                            value={performance.reps ?? null}
                            onChange={(val) => onUpdate({ ...performance, reps: val })}
                            placeholder="—"
                            step={1}
                            min={0}
                            aria-label={`Reps for ${headerLabel.toLowerCase()} ${index + 1}`}
                        />
                        <NumericStepper
                            value={performance.weight ?? null}
                            onChange={(val) => onUpdate({ ...performance, weight: val })}
                            placeholder="—"
                            step={2.5}
                            min={0}
                            aria-label={`Weight for ${headerLabel.toLowerCase()} ${index + 1}`}
                        />
                    </>
                )}

                {/* Cardio fields */}
                {category === "cardio" && (
                    <>
                        {formatTime(milliseconds)}
                        <NumericStepper
                            value={Number(performance.distance) ?? null}
                            onChange={(val) => onUpdate({ ...performance, distance: val ? String(val) : null, })}
                            placeholder="—"
                            step={0.1}
                            min={0}
                            aria-label={`Distance for lap ${index + 1}`}
                        />
                    </>
                )}

                {/* Flexibility or other categories can be added here */}
                {category === "flexibility" && (
                    <div className="text-center text-muted-foreground py-4">
                        Flexibility tracking to be implemented
                    </div>
                )}
            </div>
        </div>
    );
};


//=============================================================================
//----------------------------Flexibility Card---------------------------------
//=============================================================================
interface FlexibilityHoldCardProps {
    exerciseLog: OptimisticExerciseLog; // The parent exercise log containing performances
}

export const FlexibilityHoldCard = ({ exerciseLog }: FlexibilityHoldCardProps) => {
    const { updateSet } = useTracker();

    // Use the first (and presumably only) performance; create one if none exists
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
            {/* Primary Hold Timer */}
            <div className="text-center">
                <p className="text-sm text-muted-foreground">Duration</p>
                <Timer
                    initialMilliseconds={performance.duration ?? 0}
                    showControls={true}
                    onStop={(finalMs) => handleUpdate({ duration: finalMs })}
                />
            </div>

            {/* Optional Intensity Rating */}
            <div className="flex flex-col items-center gap-3 w-full max-w-xs">
                <p className="text-sm text-muted-foreground">Perceived Intensity</p>
                <div className="flex gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                        <Button
                            key={level}
                            variant={performance.rpe === level ? "default" : "outline"}
                            size="sm"
                            className="w-10 h-10 rounded-full"
                            onClick={() => handleUpdate({ rpe: level })}
                        >
                            {level}
                        </Button>
                    ))}
                </div>
                {/* {performance.rpe && (
                    <p className="text-xs text-muted-foreground mt-2">
                        Rated {performance.rpe}/10
                    </p>
                )} */}
            </div>

            {/* Optional: Notes field (future extension) */}
            {/* <div className="w-full">
                <Label>Notes</Label>
                <Input
                    placeholder="How did it feel? Any observations..."
                    value={performance.notes ?? ""}
                    onChange={(e) => handleUpdate({ notes: e.target.value })}
                />
            </div> */}
        </div>
    );
};
