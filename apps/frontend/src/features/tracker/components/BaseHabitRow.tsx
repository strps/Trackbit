import { cn } from "@/shared/utils/utils";

// -------------------------------------------------------------------
// Base habit row card shell
// -------------------------------------------------------------------
interface HabitRowProps {
    accentColor: string;
    icon: React.ReactNode;
    name: string;
    badges?: React.ReactNode;
    subtitle: React.ReactNode;
    right: React.ReactNode;
    className?: string;
    inactive?: boolean;
}

export const BaseHabitRow = ({ accentColor, icon, name, badges, subtitle, right, className, inactive }: HabitRowProps) => (
    <div className={cn(
        `h-17 relative  bg-card text-card-foreground border rounded-xl shadow-sm overflow-hidden transition-all py-3 pr-3 pl-20`,
        inactive ? 'grayscale opacity-60' : '',
        className
    )}>
        <div className="absolute top-0 left-0 bottom-0 w-12 rounded-l-xl flex justify-center items-center" style={{ backgroundColor: accentColor }}>
            {icon}
            <div className="absolute left-[calc(100%-0.5rem)] h-full flex flex-col justify-between items-start py-2">
                {badges && <div className="flex flex-col gap-1">{badges}</div>}
            </div>
        </div>
        <div className="flex items-center justify-between gap-4 h-full">
            <div className="flex items-center gap-4 min-w-0">
                <div className="min-w-0">
                    <h3 className={cn("font-semibold truncate", inactive && "text-sm")}>{name}</h3>
                    <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
                </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
                {right}
            </div>
        </div>
    </div>
);
