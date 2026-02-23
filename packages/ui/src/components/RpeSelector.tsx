import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// RPE colour zones: 1-3 green, 4-6 amber, 7-8 orange, 9-10 red
const getRpeZone = (level: number) => {
    if (level <= 3) return { pip: "bg-emerald-500 border-emerald-500", btn: "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500" };
    if (level <= 6) return { pip: "bg-amber-400 border-amber-400", btn: "bg-amber-400 hover:bg-amber-500 text-white border-amber-400" };
    if (level <= 8) return { pip: "bg-orange-500 border-orange-500", btn: "bg-orange-500 hover:bg-orange-600 text-white border-orange-500" };
    return { pip: "bg-red-500 border-red-500", btn: "bg-red-500 hover:bg-red-600 text-white border-red-500" };
};

const getPipColor = (position: number, filled: boolean) => {
    if (!filled) return "bg-muted border-border";
    return getRpeZone(position).pip;
};

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

// ── Shared pip bar (read-only display, also used as popover trigger) ──────────
interface PipBarProps {
    value: number | null;
    hovered: number | null;
    onHover: (v: number | null) => void;
    onPipClick: (v: number) => void;
}

const PipBar = ({ value, hovered, onHover, onPipClick }: PipBarProps) => {
    const activeLevel = hovered ?? value;
    return (
        <div
            className="flex gap-0.5 w-full"
            onMouseLeave={() => onHover(null)}
            role="slider"
            aria-valuemin={1}
            aria-valuemax={10}
            aria-valuenow={value ?? undefined}
        >
            {Array.from({ length: 10 }, (_, i) => {
                const pip = i + 1;
                const isFilled = activeLevel != null && pip <= activeLevel;
                return (
                    <button
                        key={pip}
                        type="button"
                        title={`RPE ${pip} – ${RPE_LABELS[pip]}`}
                        aria-label={`RPE ${pip}`}
                        onMouseEnter={() => onHover(pip)}
                        onClick={() => onPipClick(pip)}
                        className={cn(
                            "flex-1 h-2 rounded-full border transition-all duration-100 cursor-pointer hover:scale-y-150",
                            getPipColor(pip, isFilled),
                        )}
                    />
                );
            })}
        </div>
    );
};

// ── Popover grid: 2 rows × 5 columns of large touch-friendly buttons ─────────
interface RpePopoverGridProps {
    value: number | null;
    onChange: (v: number | null) => void;
    onClose: () => void;
}

const RpePopoverGrid = ({ value, onChange, onClose }: RpePopoverGridProps) => (
    <div className="flex flex-col gap-2 p-1">
        <p className="text-xs text-center text-muted-foreground font-medium px-1">Rate of Perceived Exertion</p>
        <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: 10 }, (_, i) => {
                const level = i + 1;
                const zone = getRpeZone(level);
                const isActive = value === level;
                return (
                    <button
                        key={level}
                        type="button"
                        aria-label={`RPE ${level}`}
                        title={RPE_LABELS[level]}
                        onClick={() => {
                            onChange(isActive ? null : level);
                            onClose();
                        }}
                        className={cn(
                            "flex flex-col items-center justify-center rounded-lg w-12 h-12 border-2 transition-all duration-100 font-bold text-base",
                            isActive
                                ? zone.btn + " ring-2 ring-offset-1 ring-current scale-105"
                                : "bg-muted/40 border-border text-foreground hover:border-current " + zone.btn.replace("text-white", ""),
                        )}
                    >
                        {level}
                    </button>
                );
            })}
        </div>
        {value != null && (
            <p className="text-xs text-center text-muted-foreground italic">{RPE_LABELS[value]}</p>
        )}
    </div>
);

// ── Public component ──────────────────────────────────────────────────────────

interface RpeSelectorProps {
    value: number | null;
    onChange: (value: number | null) => void;
    className?: string;
    label?: string;
    /** Compact mode: hides the label row and description text, suitable for tight spaces */
    compact?: boolean;
}

export const RpeSelector = ({
    value,
    onChange,
    className,
    label = "RPE",
    compact = false,
}: RpeSelectorProps) => {
    const [hovered, setHovered] = useState<number | null>(null);
    const [popoverOpen, setPopoverOpen] = useState(false);

    const activeLevel = hovered ?? value;

    const pipBar = (
        <PipBar
            value={value}
            hovered={hovered}
            onHover={setHovered}
            onPipClick={(pip) => onChange(value === pip ? null : pip)}
        />
    );

    return (
        <div className={cn("flex flex-col gap-1 w-full", className)}>
            {!compact && (
                <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">{label}</span>
                    {activeLevel != null ? (
                        <span className="text-xs text-muted-foreground tabular-nums">
                            {activeLevel}
                            <span className="ml-1 opacity-60">/ 10</span>
                        </span>
                    ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                </div>
            )}

            {/* Desktop: interact directly on the pip bar; mobile: popover on tap */}
            <div className="hidden sm:block">{pipBar}</div>

            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                    <div className="sm:hidden cursor-pointer" aria-label="Open RPE selector">
                        {pipBar}
                    </div>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" side="top" align="center">
                    <RpePopoverGrid
                        value={value}
                        onChange={onChange}
                        onClose={() => setPopoverOpen(false)}
                    />
                </PopoverContent>
            </Popover>

            {compact ? (
                <p className="text-[10px] text-muted-foreground/60 text-center leading-none h-3">
                    {activeLevel != null ? `RPE ${activeLevel}` : <span className="italic">RPE —</span>}
                </p>
            ) : (
                <p className="text-xs text-muted-foreground/60 italic text-right leading-none h-3">
                    {activeLevel != null ? RPE_LABELS[activeLevel] : ""}
                </p>
            )}
        </div>
    );
};
