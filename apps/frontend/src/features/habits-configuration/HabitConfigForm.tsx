import { GRADIENT_PRESETS, ColorThemeField } from "@/features/habits-configuration/ColorThemeField";
import { IconSelector } from "./IconField";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { CheckCircle, List, Save, ShieldAlert, Trash2 } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/shared/components/ui/alert-dialog";
import { z } from "zod";
import { BigButton } from "@/shared/components/BigButton";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Habit } from "@trackbit/types"
import { useHabits } from "./use-habits";
import { TextField } from "@/shared/components/Fields/TextField";
import { RangeField } from "@/shared/components/Fields/RangeField";
import { Field } from "@/shared/components/Fields/FieldBase";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ApiError } from "@/shared/lib/api-error";
import { Lock } from "lucide-react";

const TRACKING_TYPE_IDS = [
    { id: 'count', icon: CheckCircle },
    { id: 'check', icon: CheckCircle },
    { id: 'timed', icon: CheckCircle },
    { id: 'complex', icon: List },
] as const;

const formSchema = z.object({
    id: z.number().optional(),
    name: z.string().min(3).max(50),
    description: z.string().optional().nullable(),
    type: z.enum(["count", "complex", "negative", "timed", "check"]).optional(),
    icon: z.string().optional(),
    isAntiHabit: z.boolean(),
    colorTheme: z.enum(["green", "blue", "orange", "purple", "rose", "fire", "custom"]),
    colorStops: z.array(
        z.object({
            position: z.number().min(0).max(1),
            color: z.array(z.number().min(0).max(255)).length(4)
        })
    ),
    dailyGoal: z.number().min(0).max(1440),
    weeklyGoal: z.number().min(1).max(7),
    order: z.number().int().min(0),
});

const defaultValues = {
    name: "",
    description: undefined as string | undefined,
    type: "count" as const,
    colorTheme: "green",
    colorStops: GRADIENT_PRESETS.custom.stops,
    icon: "star",
    isAntiHabit: false,
    dailyGoal: 5,
    weeklyGoal: 7,
    order: 0,
} satisfies z.infer<typeof formSchema>;

const TimeDurationField = ({ form }: { form: ReturnType<typeof useForm<z.infer<typeof formSchema>>> }) => {
    const { t } = useTranslation('habits');
    const totalMinutes = useWatch({ control: form.control, name: 'dailyGoal' });
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const h = Math.max(0, Math.min(23, Number(e.target.value) || 0));
        form.setValue('dailyGoal', h * 60 + minutes, { shouldDirty: true });
    };

    const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const m = Math.max(0, Math.min(59, Number(e.target.value) || 0));
        form.setValue('dailyGoal', hours * 60 + m, { shouldDirty: true });
    };

    return (
        <div className="space-y-2" data-vaul-no-drag>
            <Label>{t('form.daily_goal_duration')}</Label>
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                    <Input
                        type="number"
                        min={0}
                        max={23}
                        value={hours}
                        onChange={handleHoursChange}
                        className="w-16 text-center"
                    />
                    <span className="text-sm text-muted-foreground">{t('form.duration_hours')}</span>
                </div>
                <span className="text-lg font-bold text-muted-foreground">:</span>
                <div className="flex items-center gap-1.5">
                    <Input
                        type="number"
                        min={0}
                        max={59}
                        value={minutes}
                        onChange={handleMinutesChange}
                        className="w-16 text-center"
                    />
                    <span className="text-sm text-muted-foreground">{t('form.duration_minutes')}</span>
                </div>
            </div>
        </div>
    );
};


interface HabitConfigProps {
    habit?: Habit | null;
    onDelete?: (id: number) => void;
    onCancel: () => void;
}

export const HabitConfigForm = ({
    habit,
    onDelete,
    onCancel
}: HabitConfigProps) => {
    const { t } = useTranslation('habits');
    const { t: tErrors } = useTranslation('errors');
    const { createHabit, updateHabit, isSaving } = useHabits();
    const isFrozen = !!habit?.frozen;

    const handleMutationError = (err: unknown) => {
        if (err instanceof ApiError) {
            switch (err.code) {
                case 'habit_limit_reached':
                    toast.error(tErrors('limits.habit_limit_reached_title'), {
                        description: tErrors('limits.habit_limit_reached_body', { maxHabits: err.payload.maxHabits ?? 0 }),
                    });
                    return;
                case 'habit_type_not_allowed':
                    toast.error(tErrors('limits.habit_type_not_allowed_title'), {
                        description: tErrors('limits.habit_type_not_allowed_body', {
                            type: form.getValues('type') ?? '',
                            allowed: (err.payload.allowedHabitTypes ?? []).join(', '),
                        }),
                    });
                    return;
                case 'habit_frozen':
                    toast.error(tErrors('limits.habit_frozen_title'), {
                        description: tErrors('limits.habit_frozen_body'),
                    });
                    return;
            }
        }
        toast.error(tErrors('generic_title'), { description: tErrors('generic_message') });
    };

    const form = useForm<z.infer<typeof formSchema>>({
        mode: "onSubmit",
        reValidateMode: "onSubmit",
        resolver: zodResolver(formSchema),
        defaultValues
    });

    useEffect(() => {
        resetForm()
    }, [habit]);


    const resetForm = () => {
        form.reset(habit ? habit : defaultValues);
    };

    const handleCancel = () => {
        resetForm();
        onCancel();
    };

    const onSubmit = (data: z.infer<typeof formSchema>) => {
        const options = { onSuccess: handleCancel, onError: handleMutationError };
        if (!data.id)
            createHabit(data as Habit, options);
        else
            updateHabit(data as Habit, options);
    };

    const habitType = useWatch({ control: form.control, name: 'type' });

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-y-auto">
            <div className="p-6 space-y-8 flex-1">

                {isFrozen && (
                    <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 p-3">
                        <Lock className="w-4 h-4 mt-0.5 shrink-0" />
                        <div className="text-sm">
                            <div className="font-semibold">{tErrors('limits.habit_frozen_title')}</div>
                            <div className="text-muted-foreground">{tErrors('limits.habit_frozen_body')}</div>
                        </div>
                    </div>
                )}

                <TextField
                    name="name"
                    label={t('form.name')}
                    placeholder={t('form.name_placeholder')}
                    className="text-4xl! h-14"
                    form={form}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    <RangeField
                        name="weeklyGoal"
                        label={t('form.weekly_goal')}
                        form={form}
                        min={1}
                        max={7}
                    />

                    {habitType === 'timed' ? (
                        <TimeDurationField form={form} />
                    ) : habitType !== 'check' ? (
                        <RangeField
                            name="dailyGoal"
                            label={t('form.daily_goal_times')}
                            form={form}
                            min={0}
                            max={100}
                        />
                    ) : null}

                </div>

                {/* Tracking Method */}
                <div className="space-y-3">
                    <Field
                        name="type"
                        label={t('form.tracking_method')}
                        form={form}
                        fieldInput={({ field }) => (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {TRACKING_TYPE_IDS.map((type) => {
                                    const Icon = type.icon;
                                    return (
                                        <BigButton
                                            key={type.id}
                                            isSelected={field.value === type.id}
                                            onClick={() => field.onChange(type.id)}
                                        >
                                            <div className="p-2 rounded-lg">
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="font-bold">{t(`type.${type.id}.label`)}</div>
                                                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                                    {t(`type.${type.id}.description`)}
                                                </div>
                                            </div>
                                        </BigButton>
                                    );
                                })}
                            </div>
                        )}
                    />
                </div>

                {/* Anti-Habit Toggle - only for count, check, timed */}
                {(['count', 'check', 'timed'] as const).includes(habitType as any) && (
                    <Field
                        name="isAntiHabit"
                        label=""
                        form={form}
                        fieldInput={({ field }) => (
                            <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors">
                                <ShieldAlert className={`w-5 h-5 ${field.value ? 'text-destructive' : 'text-muted-foreground'}`} />
                                <div className="flex-1">
                                    <div className="font-bold text-sm">{t('form.anti_habit')}</div>
                                    <div className="text-xs text-muted-foreground">{t('form.anti_habit_description')}</div>
                                </div>
                                <Switch
                                    checked={!!field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </label>
                        )}
                    />
                )}

                <div className="h-px bg-slate-100 dark:bg-slate-700" />

                {/* Appearance Section */}
                <div className="grid grid-cols-1 gap-8">

                    {/* Icon */}
                    <Field
                        form={form}
                        name="icon"
                        fieldInput={({ field }) => (
                            <div className="space-y-3">
                                <label className="block text-sm font-bold">{t('form.icon')}</label>
                                <IconSelector
                                    selected={field.value}
                                    onChange={field.onChange}
                                />
                            </div>
                        )}
                    />

                    {/* Color */}
                    <ColorThemeField form={form} />

                </div>

            </div>

            {/* Footer actions */}
            <div className="border-t border-border p-4 flex gap-2 justify-end sticky bottom-0 bg-background">
                {habit && onDelete && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button type="button" variant="destructive" className="flex items-center gap-2 mr-auto">
                                <Trash2 className="w-4 h-4" /> {t('form.delete')}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>{t('form.delete_title', { name: habit.name })}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {t('form.delete_body')}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>{t('form.cancel')}</AlertDialogCancel>
                                <AlertDialogAction
                                    className="bg-destructive text-white hover:bg-destructive/90"
                                    onClick={() => onDelete(habit.id)}
                                >
                                    {t('form.delete')}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
                <Button type="button" variant="outline" onClick={handleCancel}>{t('form.cancel')}</Button>
                <Button type="submit" disabled={isSaving || isFrozen} className="flex items-center gap-2">
                    <Save className="w-4 h-4" /> {t('form.save')}
                </Button>
            </div>
        </form>
    );
};
