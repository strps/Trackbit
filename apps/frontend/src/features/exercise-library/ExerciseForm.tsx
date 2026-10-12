import { Check } from 'lucide-react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
    EXERCISE_DIFFICULTIES, EXERCISE_EQUIPMENT, STEP_LIST_ENTRY_MAX_LENGTH, STEP_LIST_MAX_ENTRIES,
} from '@trackbit/types';
import { useExercises, type ExerciseWithLastPerformance } from '@/hooks/use-exercises';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { ChoiceListField, SelectListOptionComponentProps } from '@/shared/components/Fields/ChoiceListField';
import { TextField } from '@/shared/components/Fields/TextField';
import { TextAreaField } from '@/shared/components/Fields/TextAreaField';
import { StringListField, type StringListLabels } from '@/shared/components/Fields/StringListField';
import { ApiError } from '@/shared/lib/api-error';
import { variantOfCandidates } from './exercise-family';
import { VariantOfField } from './VariantOfField';
import { useCategoryConfig, type ExerciseCategoryOption } from './category-config';

// The server's rules (exercises.ts, lib/exercise-info.ts), checked here first. Blank list entries
// are dropped and an empty list is stored as none by the server, so they pass here.
const stepList = z.array(z.string().trim().max(STEP_LIST_ENTRY_MAX_LENGTH)).max(STEP_LIST_MAX_ENTRIES);
const createExerciseSchema = z.object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500),
    category: z.enum(['strength', 'cardio', 'flexibility']),
    muscleGroups: z.array(z.number()),
    instructions: stepList,
    tips: stepList,
    commonMistakes: stepList,
    equipment: z.array(z.enum(EXERCISE_EQUIPMENT)),
    // The chips leave '' when none is picked.
    difficulty: z.union([z.enum(EXERCISE_DIFFICULTIES), z.literal('')]).transform((d) => d || null),
    variantOfId: z.number().nullable(),
});

type ExerciseFormInput = z.input<typeof createExerciseSchema>;
type ExerciseFormOutput = z.output<typeof createExerciseSchema>;

const ChipOption = ({ value, label, isSelected, onToggle }: SelectListOptionComponentProps) => (
    <div
        onClick={() => onToggle(value)}
        className={`cursor-pointer px-3 py-2 rounded-md border text-sm font-medium transition-all ${isSelected
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-background hover:bg-accent hover:text-accent-foreground border-input'}`}
    >
        {label}
    </div>
);

type ExerciseFormProps = {
    onSuccess: () => void;
    exercise?: ExerciseWithLastPerformance;
};

const ExerciseForm = ({ onSuccess, exercise }: ExerciseFormProps) => {
    const { t } = useTranslation('exercises');
    const { t: tErrors } = useTranslation('errors');
    const { exercises, createExercise, isCreating, updateExercise, isUpdating, muscleGroups } = useExercises();
    const categories = useCategoryConfig();
    const isEditMode = !!exercise;

    const form = useForm<ExerciseFormInput, unknown, ExerciseFormOutput>({
        defaultValues: {
            name: exercise?.name ?? '',
            category: (exercise?.category ?? 'strength') as 'strength' | 'cardio' | 'flexibility',
            muscleGroups: exercise?.muscleGroups.map((m) => m.id) ?? [],
            description: exercise?.description ?? '',
            instructions: exercise?.instructions ?? [],
            tips: exercise?.tips ?? [],
            commonMistakes: exercise?.commonMistakes ?? [],
            equipment: exercise?.equipment ?? [],
            difficulty: exercise?.difficulty ?? '',
            variantOfId: exercise?.variantOfId ?? null,
        },
        resolver: zodResolver(createExerciseSchema)
    });

    const handleSubmit = async (data: ExerciseFormOutput) => {
        try {
            if (isEditMode) {
                await updateExercise({ id: exercise.id, ...data });
            } else {
                await createExercise(data);
            }
            form.reset();
            onSuccess();
        } catch (err) {
            if (err instanceof ApiError) {
                if (err.code === 'custom_exercise_limit_reached') {
                    toast.error(tErrors('limits.custom_exercise_limit_reached_title'), {
                        description: tErrors('limits.custom_exercise_limit_reached_body', { maxCustomExercises: err.payload.maxCustomExercises ?? 0 }),
                    });
                    return;
                }
                if (err.code === 'custom_exercise_frozen') {
                    toast.error(tErrors('limits.custom_exercise_frozen_title'), {
                        description: tErrors('limits.custom_exercise_frozen_body'),
                    });
                    return;
                }
                if (err.code === 'exercise_name_taken') {
                    form.setError('name', { message: t('error.name_taken_body') });
                    return;
                }
                if (err.code === 'invalid_variant_of') {
                    form.setError('variantOfId', { message: t('error.invalid_variant_of') });
                    return;
                }
            }
            toast.error(t('error.generic_title'), { description: t('error.generic_body') });
        }
    };

    const options = muscleGroups.map(m => ({ value: m.id, label: m.name }));
    const equipmentOptions = EXERCISE_EQUIPMENT.map((value) => ({ value, label: t(`equipment.${value}`) }));
    const difficultyOptions = EXERCISE_DIFFICULTIES.map((value) => ({ value, label: t(`difficulty.${value}`) }));
    const candidates = variantOfCandidates(exercise, exercises);
    const listLabels = (entryPlaceholder: (n: number) => string): StringListLabels => ({
        add: t('form.list_add'),
        remove: t('form.list_remove'),
        moveUp: t('form.list_move_up'),
        moveDown: t('form.list_move_down'),
        entryPlaceholder,
    });

    return (
        <div className="pt-4">
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">

                {/* Name & Target */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className='flex flex-col gap-4'>

                        <TextField
                            name="name"
                            label={t('form.name_label')}
                            placeholder={t('form.name_placeholder')}
                            form={form}
                        />
                        <TextAreaField
                            name="description"
                            label={t('form.description_label')}
                            placeholder={t('form.description_placeholder')}
                            form={form}
                        />
                    </div>


                    {options.length === 0 ? (
                        <div className="space-y-2">
                            <p className="text-sm font-medium">{t('form.muscles_label')}</p>
                            <p className="text-sm text-muted-foreground">{t('form.muscles_empty')}</p>
                        </div>
                    ) : (
                        <ChoiceListField
                            form={form}
                            name='muscleGroups'
                            label={t('form.muscles_label')}
                            options={options}
                            mode='multi'
                            className='flex flex-wrap gap-2'
                            optionComponent={ChipOption}
                        />
                    )}



                </div>

                <ChoiceListField
                    form={form}
                    name='category'
                    label={t('form.category_label')}
                    options={categories}
                    className='grid grid-cols-1 md:grid-cols-2 gap-6'
                    optionComponent={({ value, label, isSelected, onToggle, icon: Icon, fields, ...props }: SelectListOptionComponentProps<ExerciseCategoryOption>) => {
                        return (
                            <div
                                onClick={() => onToggle(value)}
                                className={`
                                                    cursor-pointer p-4 rounded-xl border-2 transition-all relative overflow-hidden
                                                    ${isSelected
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border hover:border-accent'}
                                                `}
                            >

                                <div className="flex items-start justify-between mb-2">
                                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    {isSelected && <Check className="w-5 h-5 text-primary" />}
                                </div>

                                <h4 className={`font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                                    {label}
                                </h4>

                                <p className="text-xs text-muted-foreground mt-1">{props.description}</p>

                                <div className="mt-4 pt-3 border-t border-border/50">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground mb-2 block">{t('form.inputs')}</span>
                                    <div className="flex flex-wrap gap-2">
                                        {fields.map((f: ExerciseCategoryOption['fields'][number]) => (
                                            <span key={f.label} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-muted border border-border shadow-sm text-muted-foreground font-medium">
                                                <f.icon className="w-3 h-3" /> {f.label}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )
                    }}
                />

                {/* Info: shown in the exercise's info sheet */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ChoiceListField
                        form={form}
                        name='equipment'
                        label={t('form.equipment_label')}
                        options={equipmentOptions}
                        mode='multi'
                        className='flex flex-wrap gap-2'
                        optionComponent={ChipOption}
                    />
                    <div className="flex flex-col gap-6">
                        <ChoiceListField
                            form={form}
                            name='difficulty'
                            label={t('form.difficulty_label')}
                            description={t('form.difficulty_hint')}
                            options={difficultyOptions}
                            className='flex flex-wrap gap-2'
                            optionComponent={ChipOption}
                        />
                        <VariantOfField
                            form={form}
                            name='variantOfId'
                            label={t('form.variant_of_label')}
                            description={t('form.variant_of_hint')}
                            candidates={candidates}
                            emptyHint={isEditMode && candidates.length === 0 ? t('form.variant_of_has_variants') : undefined}
                        />
                    </div>
                </div>

                <StringListField
                    form={form}
                    name='instructions'
                    label={t('form.instructions_label')}
                    labels={listLabels((n) => t('form.instructions_placeholder', { n }))}
                    maxEntries={STEP_LIST_MAX_ENTRIES}
                    maxLength={STEP_LIST_ENTRY_MAX_LENGTH}
                    numbered
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <StringListField
                        form={form}
                        name='tips'
                        label={t('form.tips_label')}
                        labels={listLabels(() => t('form.tips_placeholder'))}
                        maxEntries={STEP_LIST_MAX_ENTRIES}
                        maxLength={STEP_LIST_ENTRY_MAX_LENGTH}
                    />
                    <StringListField
                        form={form}
                        name='commonMistakes'
                        label={t('form.mistakes_label')}
                        labels={listLabels(() => t('form.mistakes_placeholder'))}
                        maxEntries={STEP_LIST_MAX_ENTRIES}
                        maxLength={STEP_LIST_ENTRY_MAX_LENGTH}
                    />
                </div>

                <Button
                    type="submit"
                    className="w-full"
                    disabled={isCreating || isUpdating}
                >
                    {isCreating || isUpdating ? t('form.saving') : isEditMode ? t('form.update') : t('form.create')}
                </Button>
            </form>
        </div>
    );
}

type ExerciseFormDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The custom exercise to edit; none to create one. */
    exercise?: ExerciseWithLastPerformance;
};

/** Creates a custom exercise, or edits [exercise]. */
export const ExerciseFormDialog = ({ open, onOpenChange, exercise }: ExerciseFormDialogProps) => {
    const { t } = useTranslation('exercises');
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{exercise ? t('form.edit_title') : t('form.create_title')}</DialogTitle>
                </DialogHeader>
                {open && <ExerciseForm exercise={exercise} onSuccess={() => onOpenChange(false)} />}
            </DialogContent>
        </Dialog>
    );
};
