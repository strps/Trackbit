import { cn } from '@/shared/utils/utils';

interface SegmentedControlProps<T extends string> {
    options: { value: T; label: string }[];
    value: T;
    onChange: (v: T) => void;
    className?: string;
}

export function SegmentedControl<T extends string>({
    options, value, onChange, className,
}: SegmentedControlProps<T>) {
    return (
        <div className={cn('flex gap-0.5 bg-muted rounded-lg p-0.5', className)}>
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    className={cn(
                        'px-3 py-1 text-xs rounded-md transition-colors font-medium',
                        value === opt.value
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}