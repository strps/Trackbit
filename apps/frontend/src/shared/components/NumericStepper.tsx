import { Minus, Plus } from "lucide-react";
import { cn } from "@/shared/utils/utils";

interface NumericStepperProps {
    value: number | null;
    onChange: (value: number) => void;
    placeholder?: string;
    step?: number;
    min?: number;
    "aria-label"?: string;
    className?: string;
}

const stepperButtonClass =
    "flex w-9 shrink-0 select-none items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-accent disabled:pointer-events-none disabled:opacity-40";

export const NumericStepper = ({
    value,
    onChange,
    placeholder = "",
    step = 1,
    min = 0,
    "aria-label": ariaLabel,
    className,
}: NumericStepperProps) => {
    const decimals = (step.toString().split(".")[1] ?? "").length;
    const round = (n: number) => parseFloat(n.toFixed(decimals));
    const increment = () => onChange(round((value ?? 0) + step));
    const decrement = () => onChange(round(Math.max(min, (value ?? 0) - step)));

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        if (raw === "") {
            onChange(null as any); // Allow temporary empty state if desired; callers can handle
            return;
        }
        const num = Number(raw);
        if (!isNaN(num) && num >= min) {
            onChange(num);
        }
    };

    return (
        <div
            className={cn(
                "border-input dark:bg-input/30 flex h-9 w-full items-stretch overflow-hidden rounded-md border bg-transparent shadow-xs transition-[color,box-shadow]",
                "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
                className
            )}
            role="group"
            aria-label={ariaLabel}
        >
            <button
                type="button"
                onClick={decrement}
                disabled={value === null || value <= min}
                className={cn(stepperButtonClass, "border-input border-r")}
                aria-label="Decrement"
                tabIndex={-1}
            >
                <Minus className="size-3.5" />
            </button>

            <input
                type="number"
                value={value ?? ""}
                onChange={handleInputChange}
                placeholder={placeholder}
                min={min}
                step={step}
                className="text-foreground placeholder:text-muted-foreground w-full min-w-0 flex-1 bg-transparent text-center text-base font-medium tabular-nums outline-none md:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                aria-label={ariaLabel}
            />

            <button
                type="button"
                onClick={increment}
                className={cn(stepperButtonClass, "border-input border-l")}
                aria-label="Increment"
                tabIndex={-1}
            >
                <Plus className="size-3.5" />
            </button>
        </div>
    );
};
