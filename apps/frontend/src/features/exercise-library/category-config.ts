import { Activity, Dumbbell, Hash, Ruler, Scale, Timer, User, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SelectOption } from '@/shared/components/Fields/ChoiceListField';

// --- Configuration: Define Behavior per Category ---
export type ExerciseCategoryOption = {
    value: string;
    label: string;
    icon: LucideIcon;
    description: string;
    fields: { label: string; icon: LucideIcon }[];
    color: string;
}

export function useCategoryConfig(): SelectOption<ExerciseCategoryOption>[] {
    const { t } = useTranslation('exercises');
    return [
        {
            value: "strength",
            label: t('category.strength'),
            icon: Dumbbell,
            description: t('category.strength_desc'),
            fields: [
                { label: t('field.sets'), icon: Hash },
                { label: t('field.reps'), icon: Activity },
                { label: t('field.weight'), icon: Scale },
            ],
            color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
        },
        {
            value: "cardio",
            label: t('category.cardio'),
            icon: Activity,
            description: t('category.cardio_desc'),
            fields: [
                { label: t('field.laps'), icon: Hash },
                { label: t('field.distance'), icon: Ruler },
                { label: t('field.duration'), icon: Timer },
            ],
            color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
        },
        {
            value: "flexibility",
            label: t('category.flexibility'),
            icon: User,
            description: t('category.flexibility_desc'),
            fields: [
                { label: t('field.duration'), icon: Timer },
            ],
            color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        }
    ];
}
