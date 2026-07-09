import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from 'react-i18next';
import { Play, Pause } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { NumericStepper } from "@/shared/components/NumericStepper";
import { OptimisticExercisePerformance, OptimisticExerciseLog } from "@/features/tracker/use-tracker";
import { TimerDisplay } from "@/shared/components/Timer";
import { RpeSelector } from "@/shared/components/RpeSelector";
import { useActivityTracker } from "../api/useActivityTracker";
import { useUnitSystem } from "@/providers/unit-system-provider";
import { kgToDisplay, displayToKg, weightUnit } from "@/shared/utils/intlFormatter";


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
    const { unitSystem } = useUnitSystem();
    const { t } = useTranslation('tracker');
    const unit = weightUnit(unitSystem);
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

    const headerLabel = category === "cardio" ? t('activity_lap') : t('activity_set');

    return (
        <div
            className={`flex flex-col shrink-0 w-32 items-center border border-border rounded-lg bg-card ${isSelected ? "ring ring-primary shadow-lg" : ""}`}
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
                            aria-label={t('activity_reps_aria', { label: headerLabel.toLowerCase(), num: index + 1 })}
                        />
                        <NumericStepper
                            value={performance.weight != null ? kgToDisplay(performance.weight, unitSystem) : null}
                            onChange={(val) => onUpdate({ ...performance, weight: val != null ? displayToKg(val, unitSystem) : null })}
                            placeholder="—"
                            step={unitSystem === 'imperial' ? 5 : 2.5}
                            min={0}
                            aria-label={t('activity_weight_aria', { unit, label: headerLabel.toLowerCase(), num: index + 1 })}
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
                            aria-label={t('activity_distance_aria', { num: index + 1 })}
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
                        {t('activity_flexibility_wip')}
                    </div>
                )}
            </div>
        </div>
    );
};
