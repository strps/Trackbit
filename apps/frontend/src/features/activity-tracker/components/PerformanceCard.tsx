import React, { useState, useEffect, useRef } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { NumericStepper } from "@/shared/components/NumericStepper";
import { OptimisticExercisePerformance, OptimisticExerciseLog } from "@/features/tracker/use-tracker";
import { TimerDisplay } from "@/shared/components/Timer";
import { RpeSelector } from "@/shared/components/RpeSelector";
import { useActivityTracker } from "../api/useActivityTracker";


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
    const latestMsRef = useRef(milliseconds);

    const handleMsChange = (ms: number) => {
        latestMsRef.current = ms;
        setMilliseconds(ms);
    };

    useEffect(() => {
        let interval: any;
        if (isTimerRunning) {
            interval = setInterval(() => {
                setMilliseconds((prev) => {
                    const next = prev + 100;
                    latestMsRef.current = next;
                    return next;
                });
            }, 100);
        } else if (!isTimerRunning && milliseconds !== performance.duration) {
            onUpdate({ ...performance, duration: milliseconds });
        }
        return () => interval && clearInterval(interval);
    }, [isTimerRunning, milliseconds, performance, onUpdate]);

    const headerLabel = category === "cardio" ? "Lap" : "Set";

    return (
        <div
            className={`flex flex-col shrink-0 w-26 items-center border border-border rounded-lg bg-card ${isSelected ? "ring ring-primary shadow-lg" : ""}`}
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
                        <RpeSelector
                            compact
                            value={performance.rpe ?? null}
                            onChange={(val) => onUpdate({ ...performance, rpe: val })}
                        />
                    </>
                )}
                {category === "cardio" && (
                    <>
                        <TimerDisplay
                            milliseconds={milliseconds}
                            isRunning={isTimerRunning}
                            isEditable
                            showControls={false}
                            onMillisecondsChange={handleMsChange}
                            onCommit={() => onUpdate({ ...performance, duration: latestMsRef.current })}
                        />
                        <NumericStepper
                            value={performance.distance ?? null}
                            onChange={(val) => onUpdate({ ...performance, distance: val })}
                            placeholder="—"
                            step={0.1}
                            min={0}
                            aria-label={`Distance for lap ${index + 1}`}
                        />
                        <RpeSelector
                            compact
                            value={performance.rpe ?? null}
                            onChange={(val) => onUpdate({ ...performance, rpe: val })}
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
