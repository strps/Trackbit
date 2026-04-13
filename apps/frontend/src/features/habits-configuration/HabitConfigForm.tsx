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



const TRACKING_TYPES = [
    {
        id: 'count',
        label: 'Count',
        description: 'Track daily counts (e.g., glasses of water, pages read).',
        icon: CheckCircle
    },
    {
        id: 'check',
        label: 'Check',
        description: 'Simple yes/no daily completion (e.g., meditated, journaled).',
        icon: CheckCircle
    },
    {
        id: 'timed',
        label: 'Timed',
        description: 'Track duration or time spent (e.g., 30 min reading).',
        icon: CheckCircle
    },
    {
        id: 'complex',
        label: 'Structured Session',
        description: 'Log sets, reps, weights, time, or distance (e.g., Gym).',
        icon: List
    },
];

const formSchema = z.object({
    id: z.number().optional(),
    name: z
        .string()
        .min(3, "Name should be at least 3 characters long")
        .max(50, "Name should not exceed 50 characters long"),


    description: z.string().optional().nullable(),
    type: z.enum(["count", "complex", "negative", "timed", "check"]).optional(),
    icon: z.string().optional(),
    isAntiHabit: z.boolean(),
    //color theme enum
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
            <Label>Daily Goal (Duration)</Label>
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
                    <span className="text-sm text-muted-foreground">h</span>
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
                    <span className="text-sm text-muted-foreground">min</span>
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

    const { createHabit, updateHabit } = useHabits();

    const form = useForm<z.infer<typeof formSchema>>({
        mode: "onSubmit",
        reValidateMode: "onSubmit",
        resolver: zodResolver(formSchema),

        defaultValues
    });

    useEffect(() => {
        resetForm()
    }, [habit, /*form*/]);


    const resetForm = () => {
        form.reset(
            habit
                ? habit
                : defaultValues
        );
    };

    const handleCancel = () => {
        resetForm();
        onCancel();
    };


    const onSubmit = (data: z.infer<typeof formSchema>) => {
        if (!data.id)
            createHabit(data as Habit);
        else
            updateHabit(data as Habit);
    };

    const habitType = useWatch({ control: form.control, name: 'type' });

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-y-auto">
            <div className="p-6 space-y-8 flex-1">

                <TextField
                    name="name"
                    label="Habit Name"
                    placeholder="e.g., Drink Water"
                    className="text-4xl! h-14"
                    form={form}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    <RangeField
                        name="weeklyGoal"
                        label="Weekly Goal (Days)"
                        form={form}
                        min={1}
                        max={7}
                    />

                    {habitType === 'timed' ? (
                        <TimeDurationField
                            form={form}
                        />
                    ) : habitType !== 'check' ? (
                        <RangeField
                            name="dailyGoal"
                            label="Daily Goal (Times)"
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
                        label="Tracking Method"
                        form={form}
                        fieldInput={({ field }) => (

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {TRACKING_TYPES.map((type) => {
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
                                                <div className="font-bold">{type.label}</div>
                                                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                                    {type.description}
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
                                    <div className="font-bold text-sm">Anti-Habit</div>
                                    <div className="text-xs text-muted-foreground">Mark as a bad habit you want to reduce or avoid (e.g., Smoking, Junk Food).</div>
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
                                <label className="block text-sm font-bold">Icon</label>
                                <IconSelector
                                    selected={field.value}
                                    onChange={field.onChange}
                                />
                            </div>
                        )}
                    />

                    {/* Color */}
                    <ColorThemeField
                        form={form}
                    />

                </div>

            </div>

            {/* Footer actions */}
            <div className="border-t border-border p-4 flex gap-2 justify-end sticky bottom-0 bg-background">
                {habit && onDelete && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button type="button" variant="destructive" className="flex items-center gap-2 mr-auto">
                                <Trash2 className="w-4 h-4" /> Delete
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete "{habit.name}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete this habit and all its tracked data. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    className="bg-destructive text-white hover:bg-destructive/90"
                                    onClick={() => onDelete(habit.id)}
                                >
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
                <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>
                <Button type="submit" className="flex items-center gap-2">
                    <Save className="w-4 h-4" /> Save
                </Button>
            </div>
        </form>
    );
};
