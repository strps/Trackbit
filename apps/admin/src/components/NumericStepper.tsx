import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button"; // Assuming shadcn/ui or similar
import { Input } from "@/components/ui/input"; // Optional: for base styling consistency

interface NumericStepperProps {
    value: number | null;
    onChange: (value: number) => void;
    placeholder?: string;
    step?: number;
    min?: number;
    "aria-label"?: string;
    className?: string;
}

export const NumericStepper = ({
    value,
    onChange,
    placeholder = "",
    step = 1,
    min = 0,
    "aria-label": ariaLabel,
    className,
}: NumericStepperProps) => {
    const increment = () => onChange((value ?? 0) + step);
    const decrement = () => onChange(Math.max(min, (value ?? 0) - step));

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

    const containerClasses = `
    grid grid-cols-[1fr_1fr_1fr] w-full overflow-hidden border border-border shadow-inner
    ${className ?? ""}
  `.trim();

    const buttonClass = "aspect-square bg-background hover:bg-accent transition-colors disabled:opacity-50 flex items-center justify-center border-r border-border"

    return (
        <div className={containerClasses} role="spinbutton" aria-valuenow={value ?? undefined} aria-label={ariaLabel}>
            <button
                type="button"
                onClick={decrement}
                disabled={value === null || value <= min}
                className={buttonClass}
                aria-label="Decrement"
                tabIndex={-1}
            >
                <Minus className="w-3 h-3 text-muted-foreground" />
            </button>

            <input
                type="number"
                value={value ?? ""}
                onChange={handleInputChange}
                placeholder={placeholder}
                min={min}
                step={step}
                className="flex-1 min-w-0 text-center bg-transparent text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-medium"
                aria-label={ariaLabel}
            />

            <button
                type="button"
                onClick={increment}
                className="flex-none w-8 bg-background hover:bg-accent transition-colors flex items-center justify-center border-l border-border"
                aria-label="Increment"
                tabIndex={-1}
            >
                <Plus className="w-3 h-3 text-muted-foreground" />
            </button>
        </div>
    );
};