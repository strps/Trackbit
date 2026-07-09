import { useState, useEffect, useRef } from "react";
import { useTranslation } from 'react-i18next';
import { NumericStepper } from "@/shared/components/NumericStepper";
import { OptimisticExercisePerformance } from "@/features/tracker/use-tracker";
import { TimerDisplay } from "@/shared/components/Timer";
import { RpeSelector } from "@/shared/components/RpeSelector";
import { useUnitSystem } from "@/providers/unit-system-provider";
import { kgToDisplay, displayToKg, weightUnit } from "@/shared/utils/intlFormatter";

interface SetEditorProps {
    performance: OptimisticExercisePerformance;
    index: number;
    category: "strength" | "cardio" | "flexibility";
    onUpdate: (updated: OptimisticExercisePerformance) => void;
}

/**
 * The per-set editing controls (reps/weight/RPE for strength; timer/distance/RPE for cardio),
 * shared by the classic PerformanceCard body and the compact card's popover.
 */
export const SetEditor = ({ performance, index, category, onUpdate }: SetEditorProps) => {
    const { unitSystem } = useUnitSystem();
    const { t } = useTranslation('tracker');
    const unit = weightUnit(unitSystem);
    const [milliseconds, setMilliseconds] = useState(performance.duration ?? 0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const latestMsRef = useRef(milliseconds);

    const headerLabel = category === "cardio" ? t('activity_lap') : t('activity_set');

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

    if (category === "strength") {
        return (
            <div className="flex flex-col w-full gap-3">
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
            </div>
        );
    }

    if (category === "cardio") {
        return (
            <div className="flex flex-col w-full gap-3">
                <TimerDisplay
                    milliseconds={milliseconds}
                    isRunning={isTimerRunning}
                    isEditable
                    showControls
                    onToggle={() => setIsTimerRunning((v) => !v)}
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
            </div>
        );
    }

    return (
        <div className="text-center text-muted-foreground py-4">
            {t('activity_flexibility_wip')}
        </div>
    );
};
