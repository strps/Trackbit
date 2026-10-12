import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { STEP_LIST_ENTRY_MAX_LENGTH, STEP_LIST_MAX_ENTRIES } from "@trackbit/types";
import { Button, Input, Label } from "@trackbit/ui";

interface StepListEditorProps {
    id: string;
    label: string;
    value: string[];
    onChange: (value: string[]) => void;
    /** Numbers the entries (steps) instead of bulleting them. */
    numbered?: boolean;
    placeholder?: string;
}

/** An ordered list of short texts to add to, edit, reorder and remove from. Blank entries are dropped on save. */
export function StepListEditor({ id, label, value, onChange, numbered = false, placeholder }: StepListEditorProps) {
    const move = (from: number, to: number) => {
        const next = [...value];
        [next[from], next[to]] = [next[to], next[from]];
        onChange(next);
    };

    return (
        <div className="space-y-1.5">
            <Label htmlFor={`${id}-0`}>{label}</Label>
            <div className="space-y-2">
                {value.map((entry, i) => (
                    <div key={i} className="flex items-center gap-1">
                        <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">{numbered ? `${i + 1}.` : "•"}</span>
                        <Input
                            id={`${id}-${i}`}
                            value={entry}
                            maxLength={STEP_LIST_ENTRY_MAX_LENGTH}
                            placeholder={placeholder}
                            onChange={(e) => onChange(value.map((old, j) => (j === i ? e.target.value : old)))}
                        />
                        <Button type="button" variant="ghost" size="icon" disabled={i === 0}
                            onClick={() => move(i, i - 1)} aria-label="Move up">
                            <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" disabled={i === value.length - 1}
                            onClick={() => move(i, i + 1)} aria-label="Move down">
                            <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon"
                            onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
                <Button type="button" variant="outline" size="sm" disabled={value.length >= STEP_LIST_MAX_ENTRIES}
                    onClick={() => onChange([...value, ""])}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
            </div>
        </div>
    );
}
