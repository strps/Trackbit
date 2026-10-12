import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown, Globe, User, X } from 'lucide-react';
import { Field, type FieldProps, type InputProps } from '@/shared/components/Fields/FieldBase';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { cn } from '@/shared/utils/utils';
import type { ExerciseWithLastPerformance } from '@/hooks/use-exercises';

type Candidate = Pick<ExerciseWithLastPerformance, 'id' | 'name' | 'userId'>;

type VariantOfInputProps = InputProps & { candidates: Candidate[]; emptyHint?: string };

const VariantOfInput = ({ id, field, disabled, candidates, emptyHint }: VariantOfInputProps) => {
    const { t } = useTranslation('exercises');
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const selected = candidates.find((c) => c.id === field.value);
    const matches = candidates.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()));
    const choose = (value: number | null) => {
        field.onChange(value);
        setOpen(false);
        setSearch('');
    };

    if (emptyHint) return <p className="text-sm text-muted-foreground">{emptyHint}</p>;

    return (
        <div className="flex items-center gap-1">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open}
                        className="flex-1 justify-between font-normal" disabled={disabled}>
                        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
                            {selected?.name ?? t('form.variant_of_none')}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-2">
                    <Input
                        autoFocus
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('form.variant_of_search')}
                        className="mb-2"
                    />
                    <ul className="max-h-60 overflow-y-auto" role="listbox">
                        {matches.map((c) => (
                            <li key={c.id}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={c.id === field.value}
                                    onClick={() => choose(c.id)}
                                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                                >
                                    {c.userId
                                        ? <User className="h-3 w-3 shrink-0 text-muted-foreground" />
                                        : <Globe className="h-3 w-3 shrink-0 text-muted-foreground" />}
                                    <span className="flex-1 truncate">{c.name}</span>
                                    {c.id === field.value && <Check className="h-4 w-4" />}
                                </button>
                            </li>
                        ))}
                        {matches.length === 0 && (
                            <li className="px-2 py-1.5 text-sm text-muted-foreground">{t('form.variant_of_empty')}</li>
                        )}
                    </ul>
                </PopoverContent>
            </Popover>
            {selected && (
                <Button type="button" variant="ghost" size="icon" onClick={() => choose(null)}
                    disabled={disabled} aria-label={t('form.variant_of_clear')}>
                    <X className="h-4 w-4" />
                </Button>
            )}
        </div>
    );
};

type VariantOfFieldProps = Omit<FieldProps, 'fieldInput' | 'placeholder'> & {
    /** The exercises it may become a variant of (see `variantOfCandidates`). */
    candidates: Candidate[];
    /** Shown instead of the picker when it can't be a variant at all. */
    emptyHint?: string;
};

/** Picks the base exercise this one is a variant of, or none. Its value is that exercise's id or null. */
export const VariantOfField = ({ candidates, emptyHint, ...fieldProps }: VariantOfFieldProps) => (
    <Field
        {...fieldProps}
        fieldInput={(props) => <VariantOfInput {...props} candidates={candidates} emptyHint={emptyHint} />}
    />
);
