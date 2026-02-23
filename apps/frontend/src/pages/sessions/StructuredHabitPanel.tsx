import React, { useState, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumericStepper } from "../../components/NumericStepper";
import { OptimisticExercisePerformance, OptimisticExerciseLog } from "@/pages/tracker/use-tracker";
import { useExerciseSessions } from "@/pages/sessions/use-exercise-sessions";
import { Timer } from "@/components/Timer";

// =============================================================================
// Shared helpers & components re-exported for use across pages (e.g. Landing)
// =============================================================================

/**
 * Formats a duration in seconds to a string.
 * - Less than 1 hour: "mm:ss" (e.g., "5:23")
 * - 1 hour or more: "h:mm:ss" (e.g., "1:05:23")
 */
export const formatDuration = (seconds: number | null | undefined): string => {
    if (seconds == null || isNaN(seconds)) return "-";
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

// =============================================================================
// Performance Card
// =============================================================================

interface PerformanceCardProps {
    performance: OptimisticExercisePerformance;
    index: number;
    category: "strength" | "cardio" | "flexibility";
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
            className={`flex flex-col shrink-0 w-26 items-center border border-border rounded-lg overflow-hidden bg-card ${isSelected ? "ring ring-primary shadow-lg" : ""}`}
        >
            <div
                onClick={onHeaderClick}
                className={`flex justify-between items-center w-full h-10 px-2 text-xs font-bold bg-muted/30 ${isSelected ? "bg-primary text-primary-foreground" : ""}`}
            >
                <span className={isSelected ? "text-primary-foreground" : "text-muted-foreground"}>
                    {headerLabel} {index + 1}
                </span>
                {category === "cardio" && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsTimerRunning(!isTimerRunning);
                        }}
                        className={isTimerRunning ? "bg-destructive hover:bg-destructive/90" : ""}
                    >
                        {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                )}
            </div>
            <div className="flex flex-col w-full p-2 gap-3">
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
                {category === "cardio" && (
                    <>
                        {formatTime(milliseconds)}
                        <NumericStepper
                            value={Number(performance.distance) ?? null}
                            onChange={(val) => onUpdate({ ...performance, distance: val ? String(val) : null })}
                            placeholder="—"
                            step={0.1}
                            min={0}
                            aria-label={`Distance for lap ${index + 1}`}
                        />
                    </>
                )}
                {category === "flexibility" && (
                    <div className="text-center text-muted-foreground py-4">
                        Flexibility tracking to be implemented
                    </div>
                )}
            </div>
        </div>
    );
};

// =============================================================================
// Flexibility Hold Card
// =============================================================================

interface FlexibilityHoldCardProps {
    exerciseLog: OptimisticExerciseLog;
}

export const FlexibilityHoldCard = ({ exerciseLog }: FlexibilityHoldCardProps) => {
    const { updateSet } = useExerciseSessions();
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
            <div className="text-center">
                <p className="text-sm text-muted-foreground">Duration</p>
                <Timer
                    initialMilliseconds={performance.duration ?? 0}
                    showControls={true}
                    onStop={(finalMs) => handleUpdate({ duration: finalMs })}
                />
            </div>
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
            </div>
        </div>
    );
};
