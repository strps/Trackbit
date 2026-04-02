import { Minus, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { useEffect, useState } from "react";

interface ProgressCounterProps {
    value: number;
    goal: number;
    onIncrement?: () => void; // Made optional since controls can be hidden
    onDecrement?: () => void; // Made optional since controls can be hidden
    colorString: string;
    isGoalMet?: boolean;
    showControls?: boolean;
    label?: string;
}

export const ProgressCounter = ({
    value,
    goal,
    onIncrement,
    onDecrement,
    colorString,
    isGoalMet = false,
    showControls = true, // Default to true
    label,
}: ProgressCounterProps) => {
    const [isAnimating, setIsAnimating] = useState(false);

    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.min(value / goal, 1);
    const strokeDashoffset = circumference - progress * circumference;

    useEffect(() => {
        setIsAnimating(true);
        const timer = setTimeout(() => setIsAnimating(false), 200);
        return () => clearTimeout(timer);
    }, [value]);

    return (
        <div className="flex items-center justify-center gap-4">
            {/* Conditional Decrement Button */}
            {showControls && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onDecrement}
                    disabled={value <= 0}
                    className="h-12 w-12 rounded-full border border-input text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                    <Minus className="w-6 h-6" />
                </Button>
            )}

            {/* Progress Ring (Always Visible) */}
            <div className="relative w-24 h-24 flex items-center justify-center">
                <svg className="absolute w-full h-full transform -rotate-90">
                    <circle
                        cx="50%"
                        cy="50%"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        className="text-muted"
                    />
                    <circle
                        cx="50%"
                        cy="50%"
                        r={radius}
                        stroke={colorString}
                        strokeWidth="8"
                        fill="transparent"
                        strokeLinecap="round"
                        style={{
                            strokeDasharray: circumference,
                            strokeDashoffset,
                            transition: "stroke-dashoffset 0.5s ease-out, stroke 0.5s ease",
                        }}
                    />
                </svg>

                <div className="relative z-10 text-center">
                    <span
                        className={`block text-3xl font-black transition-transform ${isAnimating ? "scale-125" : "scale-100"
                            }`}
                        style={{ color: colorString }}
                    >
                        {value}
                    </span>
                    {label &&
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">
                            {label}
                        </span>
                    }
                </div>
            </div>

            {/* Conditional Increment Button */}
            {showControls && (
                <Button
                    variant="outline"
                    size="icon"
                    onClick={onIncrement}
                    className={`
            h-14 w-14 rounded-full shadow-md border-2 transition-all active:scale-95
            ${isGoalMet ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10" : "border-input bg-background"}
          `}
                    style={{
                        borderColor: !isGoalMet ? colorString : undefined,
                        color: !isGoalMet ? colorString : undefined,
                    }}
                >
                    <Plus className={`w-8 h-8 ${isGoalMet ? "text-yellow-500" : ""}`} />
                </Button>
            )}
        </div>
    );
};


export const CompactProgressCounter = ({
    value,
    goal,
    onIncrement,
    onDecrement,
    colorString,
    isGoalMet = false,
    showControls = true, // Default to true
    label,
}: ProgressCounterProps) => {
    const [isAnimating, setIsAnimating] = useState(false);

    const radius = 24;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.min(value / goal, 1);
    const strokeDashoffset = circumference - progress * circumference;

    useEffect(() => {
        setIsAnimating(true);
        const timer = setTimeout(() => setIsAnimating(false), 200);
        return () => clearTimeout(timer);
    }, [value]);

    return (
        <div className="flex items-center justify-center">
            {/* Conditional Decrement Button */}
            {showControls && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onDecrement}
                    disabled={value <= 0}
                    className=" border border-input text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                    <Minus className="w-6 h-6" />
                </Button>
            )}

            {/* Progress Ring (Always Visible) */}
            <div className="relative w-20 h-20 flex items-center justify-center">
                <svg className="absolute w-full h-full transform -rotate-90">
                    <circle
                        cx="50%"
                        cy="50%"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        className="text-muted"
                    />
                    <circle
                        cx="50%"
                        cy="50%"
                        r={radius}
                        stroke={colorString}
                        strokeWidth="8"
                        fill="transparent"
                        strokeLinecap="round"
                        style={{
                            strokeDasharray: circumference,
                            strokeDashoffset,
                            transition: "stroke-dashoffset 0.5s ease-out, stroke 0.5s ease",
                        }}
                    />
                </svg>

                <div className="relative z-10 text-center">
                    <span
                        className={`block text-3xl font-black transition-transform ${isAnimating ? "scale-125" : "scale-100"
                            }`}
                        style={{ color: colorString }}
                    >
                        {value}
                    </span>
                    {label &&
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">
                            {label}
                        </span>
                    }
                </div>
            </div>

            {/* Conditional Increment Button */}
            {showControls && (
                <Button
                    variant="outline"
                    size="icon"
                    onClick={onIncrement}
                    className={`
            shadow-md border-2 transition-all active:scale-95
            ${isGoalMet ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10" : "border-input bg-background"}
          `}
                    style={{
                        borderColor: !isGoalMet ? colorString : undefined,
                        color: !isGoalMet ? colorString : undefined,
                    }}
                >
                    <Plus className={`w-8 h-8 ${isGoalMet ? "text-yellow-500" : ""}`} />
                </Button>
            )}
        </div>
    );
};