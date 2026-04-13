// File: components/TimerDisplay.tsx
import React from "react";
import { Button } from "@/shared/components/ui/button";
import { Pause, Play } from "lucide-react";

const commonTextClass = "text-lg font-medium tabular-nums";

const formatPart = (value: number, digits: number = 2) =>
    value.toString().padStart(digits, "0");

/* =============================================================================
   PRESENTATIONAL COMPONENT – Appearance only (now with editable support)
   ============================================================================= */
interface TimerDisplayProps {
    milliseconds: number;
    isRunning: boolean;
    isEditable?: boolean;                 // New: whether to show inline inputs
    onMillisecondsChange?: (ms: number) => void; // Called when user edits manually
    onCommit?: () => void;                // Called when user finishes editing (blur/Enter)
    showControls?: boolean;
    onToggle?: () => void;
    disabledControls?: boolean;
}

export const TimerDisplay = ({
    milliseconds,
    isRunning,
    isEditable = false,
    onMillisecondsChange,
    onCommit,
    showControls = true,
    onToggle,
    disabledControls = false,
}: TimerDisplayProps) => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    const centiseconds = Math.floor((milliseconds % 1000) / 10);

    const handlePartChange = (
        part: "minutes" | "seconds" | "centiseconds",
        value: number
    ) => {
        if (!onMillisecondsChange) return;

        let newMs = milliseconds;
        if (part === "minutes") {
            newMs = value * 60000 + seconds * 1000 + centiseconds * 10;
        } else if (part === "seconds") {
            newMs = minutes * 60000 + value * 1000 + centiseconds * 10;
        } else if (part === "centiseconds") {
            newMs = minutes * 60000 + seconds * 1000 + value * 10;
        }
        onMillisecondsChange(newMs);
    };

    const inputClass =
        "text-center bg-transparent border-none outline-none focus:outline-none " +
        commonTextClass +
        " [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none " +
        "focus:underline focus:underline-offset-4 focus:decoration-primary/50";

    if (isEditable) {
        return (
            <div className="flex items-center gap-1">
                <input
                    type="number"
                    min="0"
                    name="minutes"
                    value={minutes}
                    onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        handlePartChange("minutes", val);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    onBlur={() => onCommit?.()}
                    className={inputClass}
                    style={{ width: `${Math.max(2, minutes.toString().length)}ch` }}
                />
                <span className={commonTextClass}>:</span>
                <input
                    type="number"
                    name="seconds"
                    min="0"
                    max="59"
                    value={seconds}
                    onChange={(e) => {
                        const val = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                        handlePartChange("seconds", val);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    onBlur={() => onCommit?.()}
                    className={inputClass}
                    style={{ width: "2ch" }}
                />
                <span className={commonTextClass}>.</span>
                <input
                    type="number"
                    name="centiseconds"
                    min="0"
                    max="99"
                    value={centiseconds}
                    onChange={(e) => {
                        const val = Math.min(99, Math.max(0, parseInt(e.target.value) || 0));
                        handlePartChange("centiseconds", val);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    onBlur={() => onCommit?.()}
                    className={inputClass}
                    style={{ width: "2ch" }}
                />
                {showControls && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onToggle}
                        disabled={disabledControls}
                        className={isRunning ? "bg-destructive hover:bg-destructive/90" : ""}
                    >
                        {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                )}
            </div>
        );
    }

    // Non-editable display mode
    return (
        <div className="flex items-center gap-1">
            <span className={commonTextClass}>{formatPart(minutes)}</span>
            <span className={commonTextClass}>:</span>
            <span className={commonTextClass}>{formatPart(seconds)}</span>
            <span className={commonTextClass}>.</span>
            <span className={commonTextClass}>{formatPart(centiseconds)}</span>

            {showControls && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggle}
                    disabled={disabledControls}
                    className={isRunning ? "bg-destructive hover:bg-destructive/90" : ""}
                >
                    {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
            )}
        </div>
    );
};

/* =============================================================================
   UNCONTROLLED TIMER (unchanged except for forwarding isEditable)
   ============================================================================= */
import { useState, useEffect, useRef } from "react";

interface UncontrolledTimerProps {
    initialMilliseconds?: number;
    isEditable?: boolean;
    onChange?: (ms: number) => void;
    onStart?: () => void;
    onStop?: (finalMs: number) => void;
    showControls?: boolean;
}

export const Timer = ({
    initialMilliseconds = 0,
    isEditable = false,
    onChange,
    onStart,
    onStop,
    showControls = true,
}: UncontrolledTimerProps) => {
    const [milliseconds, setMilliseconds] = useState(initialMilliseconds);
    const [isRunning, setIsRunning] = useState(false);
    const intervalRef = useRef<any | null>(null);
    const onStopRef = useRef(onStop);
    const onStartRef = useRef(onStart);
    const millisecondsRef = useRef(milliseconds);

    useEffect(() => { onStopRef.current = onStop; }, [onStop]);
    useEffect(() => { onStartRef.current = onStart; }, [onStart]);
    useEffect(() => { millisecondsRef.current = milliseconds; }, [milliseconds]);

    useEffect(() => {
        setMilliseconds(initialMilliseconds);
    }, [initialMilliseconds]);

    useEffect(() => {
        if (isRunning) {
            intervalRef.current = setInterval(() => {
                setMilliseconds((prev) => {
                    const next = prev + 10;
                    onChange?.(next);
                    return next;
                });
            }, 10);
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isRunning, onChange]);

    const handleToggle = () => {
        setIsRunning((prev) => {
            if (prev) {
                // Stopping — fire onStop with current ms
                // Use a microtask so state has settled
                setTimeout(() => onStopRef.current?.(milliseconds), 0);
            } else {
                onStartRef.current?.();
            }
            return !prev;
        });
    };

    const handleCommit = () => {
        if (!isRunning) {
            onStopRef.current?.(millisecondsRef.current);
        }
    };

    return (
        <TimerDisplay
            milliseconds={milliseconds}
            isRunning={isRunning}
            isEditable={isEditable}
            onMillisecondsChange={setMilliseconds}
            onCommit={handleCommit}
            showControls={showControls}
            onToggle={handleToggle}
        />
    );
};

/* =============================================================================
   CONTROLLED TIMER (updated to support isEditable)
   ============================================================================= */
interface ControlledTimerProps {
    milliseconds: number;
    isRunning: boolean;
    isEditable?: boolean;
    onMillisecondsChange: (ms: number) => void;
    onStop?: (finalMs: number) => void;
    showControls?: boolean;
}

export const ControlledTimer = ({
    milliseconds,
    isRunning,
    isEditable = false,
    onMillisecondsChange,
    onStop,
    showControls = true,
}: ControlledTimerProps) => {
    const intervalRef = useRef<any | null>(null);
    const wasRunning = useRef(isRunning);
    const millisecondsRef = useRef(milliseconds);

    useEffect(() => {
        millisecondsRef.current = milliseconds;
    }, [milliseconds]);

    useEffect(() => {
        if (isRunning && !wasRunning.current) {
            intervalRef.current = setInterval(() => {
                onMillisecondsChange(millisecondsRef.current + 10);
            }, 10);
        } else if (!isRunning && wasRunning.current) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            onStop?.(millisecondsRef.current);
        }

        wasRunning.current = isRunning;

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isRunning, onMillisecondsChange, onStop]);

    return (
        <TimerDisplay
            milliseconds={milliseconds}
            isRunning={isRunning}
            isEditable={isEditable}
            onMillisecondsChange={onMillisecondsChange}
            showControls={showControls}
            onToggle={undefined}
            disabledControls={true}
        />
    );
};