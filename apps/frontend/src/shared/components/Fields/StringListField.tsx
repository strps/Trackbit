import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Field, type FieldProps, type InputProps } from "@/shared/components/Fields/FieldBase";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

/** The labels the list editor's buttons need, in the caller's language. */
export interface StringListLabels {
    add: string;
    remove: string;
    moveUp: string;
    moveDown: string;
    /** Placeholder of entry [n] (1-based). */
    entryPlaceholder: (n: number) => string;
}

type StringListInputProps = InputProps & {
    labels: StringListLabels;
    maxEntries: number;
    maxLength: number;
    numbered: boolean;
};

const StringListInput = ({ field, fieldState, disabled, labels, maxEntries, maxLength, numbered }: StringListInputProps) => {
    const entries: string[] = field.value ?? [];
    const set = (next: string[]) => field.onChange(next);
    const move = (from: number, to: number) => {
        const next = [...entries];
        [next[from], next[to]] = [next[to], next[from]];
        set(next);
    };
    // Per-entry errors from an array schema sit at their index.
    const entryErrors = fieldState.error as unknown as ({ message?: string } | undefined)[] | undefined;

    return (
        <div className="flex flex-col gap-2">
            {entries.map((entry, i) => (
                <div key={i} className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                        <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">
                            {numbered ? `${i + 1}.` : '•'}
                        </span>
                        <Input
                            value={entry}
                            onChange={(e) => set(entries.map((old, j) => (j === i ? e.target.value : old)))}
                            onBlur={field.onBlur}
                            placeholder={labels.entryPlaceholder(i + 1)}
                            maxLength={maxLength}
                            disabled={disabled}
                            aria-invalid={entryErrors?.[i] ? true : undefined}
                        />
                        <Button type="button" variant="ghost" size="icon" disabled={disabled || i === 0}
                            onClick={() => move(i, i - 1)} aria-label={labels.moveUp}>
                            <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" disabled={disabled || i === entries.length - 1}
                            onClick={() => move(i, i + 1)} aria-label={labels.moveDown}>
                            <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" disabled={disabled}
                            onClick={() => set(entries.filter((_, j) => j !== i))} aria-label={labels.remove}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    {entryErrors?.[i]?.message && <p className="pl-6 text-sm text-destructive">{entryErrors[i]!.message}</p>}
                </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="self-start"
                disabled={disabled || entries.length >= maxEntries} onClick={() => set([...entries, ''])}>
                <Plus className="h-4 w-4" /> {labels.add}
            </Button>
        </div>
    );
};

type StringListFieldProps = Omit<FieldProps, "fieldInput" | "placeholder"> & {
    labels: StringListLabels;
    maxEntries: number;
    maxLength: number;
    /** Numbers the entries (steps) instead of bulleting them. */
    numbered?: boolean;
};

/** An ordered list of short texts the user adds to, edits, reorders and removes from. */
export const StringListField = ({ labels, maxEntries, maxLength, numbered = false, ...fieldProps }: StringListFieldProps) => (
    <Field
        {...fieldProps}
        fieldInput={(props) => (
            <StringListInput {...props} labels={labels} maxEntries={maxEntries} maxLength={maxLength} numbered={numbered} />
        )}
    />
);
