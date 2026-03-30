import React, { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useAnimationControls, useAnimate } from "motion/react";
import { cn } from "@/shared/utils/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

export const RPE_LABELS: Record<number, string> = {
    1: "Very Easy",
    2: "Easy",
    3: "Moderate",
    4: "Somewhat Hard",
    5: "Hard",
    6: "Hard+",
    7: "Very Hard",
    8: "Very Hard+",
    9: "Extremely Hard",
    10: "Max Effort",
};

const getRpeColor = (level: number): string => {
    if (level <= 3) return "#10b981";
    if (level <= 6) return "#f59e0b";
    if (level <= 8) return "#f97316";
    return "#ef4444";
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const levelFromX = (clientX: number, rect: DOMRect): number => {
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width - 1));
    return Math.ceil((x / rect.width) * 10) || 1;
};

/** Returns the x position of the center of pip `level` within the container. */
const pipCenterX = (level: number, rect: DOMRect): number => {
    const pipWidth = rect.width / 10;
    return (level - 1) * pipWidth + pipWidth / 2;
};

// ── Sub-components ────────────────────────────────────────────────────────────

interface PipTrackProps {
    active: number | null;
}

const PipTrack = ({ active }: PipTrackProps) => (
    <>
        {Array.from({ length: 10 }, (_, i) => {
            const pip = i + 1;
            const filled = active != null && pip <= active;
            return (
                <div
                    key={pip}
                    className="h-full flex items-center justify-center"
                >
                    <div
                        className="w-[calc(100%-2px)] h-full border border-border rounded transition-colors duration-75"
                        style={{
                            background: filled ? getRpeColor(pip) : undefined,
                        }}
                    />
                </div>
            );
        })}
    </>
);

interface TooltipProps {
    level: number;
    x: number;
    showLabel: boolean;
}

const RpeTooltip = ({ level, x, showLabel }: TooltipProps) => {
    const [scope, animate] = useAnimate();

    useEffect(() => {
        animate(scope.current, { scale: [1, 0.8, 1] }, { duration: 0.15 });
    }, [level]);

    const color = getRpeColor(level);

    return (
        <motion.div
            className="absolute bottom-[calc(100%+24px)] z-10 pointer-events-none
                   bg-popover rounded-md px-2 py-1
                   flex flex-col items-center gap-0.5 whitespace-nowrap shadow-sm
                   w-9"
            style={{ left: 0, translateX: "-50%", backgroundColor: color }}
            ref={scope}
            initial={{ x, scale: 0.1, opacity: 0 }}
            animate={{ x, opacity: 1 }}
            exit={{
                opacity: 0,
                scale: 0.5,
            }}
            transition={
                {
                    x: { type: "spring", stiffness: 500, damping: 35, mass: 0.5 },
                    default: { duration: 0.15 },
                }
            }
        >
            <motion.span
                key={level}
                className="tabular-nums text-xl text-foreground font-bold"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.5 }}
            >
                {level}
            </motion.span>
            {showLabel && (
                <motion.span
                    key={`label-${level}`}
                    className="text-[10px] text-muted-foreground"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.5 }}
                >
                    {RPE_LABELS[level]}
                </motion.span>
            )}
            {/* Arrow */}

            <svg
                className="absolute top-full left-1/2 -translate-x-1/2 z-0"
                width="30"
                height="20"
                viewBox="0 0 30 30"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <polygon points="0,0 30,0 15,30" fill={color} />
            </svg>
        </motion.div>
    );
}
// ── Public component ──────────────────────────────────────────────────────────

interface RpeSelectorProps {
    value: number | null;
    onChange: (value: number | null) => void;
    className?: string;
    /** When true, hides label row and description text. Tooltip shows number only. */
    compact?: boolean;
    label?: string;
}

export const RpeSelector = ({
    value,
    onChange,
    className,
    compact = false,
    label = "RPE",
}: RpeSelectorProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);
    const [dragStartLevel, setDragStartLevel] = useState<number | null>(null);
    const [tooltip, setTooltip] = useState<{ level: number; x: number } | null>(null);

    const getRect = () => containerRef.current?.getBoundingClientRect() ?? null;

    const showTooltip = useCallback((level: number) => {
        const rect = getRect();
        if (!rect) return;
        setTooltip({ level, x: pipCenterX(level, rect) });
    }, []);

    const hideTooltip = useCallback(() => setTooltip(null), []);

    // ── Mouse ──────────────────────────────────────────────────────────────────

    const onMouseDown = (e: React.MouseEvent) => {
        const rect = getRect();
        if (!rect) return;
        const level = levelFromX(e.clientX, rect);
        setDragging(true);
        setDragStartLevel(level);
        showTooltip(level);
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!dragging) return;
        const rect = getRect();
        if (!rect) return;
        const level = levelFromX(e.clientX, rect);
        showTooltip(level);
    };

    const onMouseUp = (e: React.MouseEvent) => {
        if (!dragging) return;
        const rect = getRect();
        if (!rect) return;
        const level = levelFromX(e.clientX, rect);
        onChange(value === level && level === dragStartLevel ? null : level);
        setDragging(false);
        setDragStartLevel(null);
        hideTooltip();
    };

    const onMouseLeave = () => {
        if (dragging) return;
        hideTooltip();
    };

    // Global mouseup so releasing outside the bar still commits
    const onDocumentMouseUp = useCallback((e: MouseEvent) => {
        if (!dragging) return;
        const rect = getRect();
        if (rect) {
            const level = levelFromX(e.clientX, rect);
            onChange(value === level && level === dragStartLevel ? null : level);
        }
        setDragging(false);
        setDragStartLevel(null);
        hideTooltip();
    }, [dragging, dragStartLevel, value, onChange, hideTooltip]);

    React.useEffect(() => {
        document.addEventListener("mouseup", onDocumentMouseUp);
        return () => document.removeEventListener("mouseup", onDocumentMouseUp);
    }, [onDocumentMouseUp]);

    // ── Touch ──────────────────────────────────────────────────────────────────

    const onTouchStart = (e: React.TouchEvent) => {
        e.preventDefault();
        const rect = getRect();
        if (!rect) return;
        const level = levelFromX(e.touches[0].clientX, rect);
        setDragging(true);
        setDragStartLevel(level);
        showTooltip(level);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        e.preventDefault();
        const rect = getRect();
        if (!rect) return;
        const level = levelFromX(e.touches[0].clientX, rect);
        showTooltip(level);
    };

    const onTouchEnd = (e: React.TouchEvent) => {
        e.preventDefault();
        const rect = getRect();
        if (!rect) return;
        const level = levelFromX(e.changedTouches[0].clientX, rect);
        onChange(value === level && level === dragStartLevel ? null : level);
        setDragging(false);
        setDragStartLevel(null);
        hideTooltip();
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    const activeLevel = tooltip?.level ?? value;

    return (
        <div className={cn("relative flex flex-col gap-1 w-full", className)}>


            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">{label}</span>
                {value != null ? (
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {value}
                        <span className="ml-1 opacity-60">/ 10</span>
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground/50">—</span>
                )}
            </div>

            {/* Track + overlay */}
            <div
                ref={containerRef}
                className="relative grid h-2 cursor-pointer select-none overflow-visible rounded-md"
                style={{ gridTemplateColumns: "repeat(10, 1fr)" }}
                role="slider"
                aria-valuemin={1}
                aria-valuemax={10}
                aria-valuenow={value ?? undefined}
                aria-label={label}
            >
                {/* Pip track */}
                <div
                    className="absolute h-2 inset-0 grid"
                    style={{ gridTemplateColumns: "repeat(10, 1fr)" }}
                >
                    <PipTrack active={activeLevel} />
                </div>

                {/* Animated tooltip */}
                <AnimatePresence>
                    {tooltip && (
                        <RpeTooltip
                            level={tooltip.level}
                            x={tooltip.x}
                            showLabel={!compact}
                        />
                    )}
                </AnimatePresence>

                {/* Interaction overlay */}
                <div
                    className="absolute inset-0 z-10"
                    style={{ touchAction: "none" }}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseLeave}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                />
            </div>
            {/* Interaction overlay */}
            <div
                className="absolute inset-0 z-10"
                style={{ touchAction: "none" }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseLeave}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            />
            {!compact && (
                <p className="text-xs text-muted-foreground/60 italic text-right leading-none h-3">
                    {value != null ? RPE_LABELS[value] : ""}
                </p>
            )}
        </div>
    );
};