import { GRADIENT_PRESETS, ColorThemeField } from "@/pages/habits-configuration/ColorThemeField";
import { IconSelector } from "./IconField";
import { Button } from "@/components/ui/button";
import { CheckCircle, Layout, List, Save, XCircle } from "lucide-react";
import { z } from "zod";
import { BigButton } from "@/components/BigButton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Habit } from "@trackbit/types"
import { useHabits } from "@/hooks/use-habits";
import { TextField } from "@/components/Fields/TextField";
import { RangeField } from "@/components/Fields/RangeField";
import { Field } from "@/components/Fields/FieldBase";



const TRACKING_TYPES = [
    {
        id: 'simple',
        label: 'Simple Completion',
        description: 'Track daily checks or counts (e.g., Read 30 mins).',
        icon: CheckCircle
    },
    {
        id: 'complex',
        label: 'Structured Session',
        description: 'Log sets, reps, weights, time, or distance (e.g., Gym).',
        icon: List
    },
    {
        id: 'negative',
        label: 'Negative Habit',
        description: 'Track bad habits to reduce or avoid (e.g., Smoking, Junk Food).',
        icon: XCircle
    }
];

const formSchema = z.object({
    id: z.number().optional(),
    name: z
        .string()
        .min(3, "Name should be at least 3 characters long")
        .max(50, "Name should not exceed 50 characters long"),


    description: z.string().optional().nullable(),
    type: z.enum(["simple", "complex", "negative"]).optional(),
    icon: z.string().optional(),
    //color theme enum
    colorTheme: z.enum(["green", "blue", "orange", "purple", "rose", "fire", "custom"]),
    colorStops: z.array(
        z.object({
            position: z.number().min(0).max(1),
            color: z.array(z.number().min(0).max(255)).length(4)
        })
    ),
    dailyGoal: z.number().min(0).max(100),
    weeklyGoal: z.number().min(1).max(7),
});

const defaultValues = {
    name: "",
    description: undefined as string | undefined,
    type: "simple" as const,
    colorTheme: "green",
    colorStops: GRADIENT_PRESETS.custom.stops,
    icon: "star",
    dailyGoal: 5,
    weeklyGoal: 7,
} satisfies z.infer<typeof formSchema>;


interface HabitConfigProps {
    isEditing: boolean;
    habit?: Habit | null;
}

export const HabitConfigForm = ({
    isEditing,
    habit
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
        console.log(habit)
        form.reset(
            habit
                ? habit
                : defaultValues
        );
    };


    const onSubmit = (data: z.infer<typeof formSchema>) => {
        if (!data.id)
            createHabit(data as Habit);
        else
            updateHabit(data as Habit);
    };

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="lg:col-span-7 relative">
            <div //TODO: remove this div, use just the form element for layout and styling
                className={`
                    rounded-2xl shadow-xl border 
                    overflow-hidden sticky top-8 transition-all duration-300
                    ${isEditing ? 'opacity-100' : 'opacity-50 grayscale pointer-events-none'}
                `}
            >
                {/* Header */}
                <div className="p-6 border-b border-border flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold">
                            {habit ? 'Edit Habit' : 'New Habit'}
                        </h2>
                        <p className="text-sm text-slate-500">Define how you want to track this routine.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" onClick={resetForm}>Cancel</Button>
                        <Button type="submit" className="flex items-center gap-2">
                            <Save className="w-4 h-4" /> Save
                        </Button>
                    </div>
                </div>

                {/* Form */}
                <div className="p-6 space-y-8">

                    {/* Name + Weekly Goal */}

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

                        <RangeField
                            name="dailyGoal"
                            label="Daily Goal (Times)"
                            form={form}
                            min={0}
                            max={100}
                        />

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

                    <div className="h-px bg-slate-100 dark:bg-slate-700" />

                    {/* Appearance Section */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

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
            </div>

            {!isEditing && (
                <div className="absolute flex flex-col items-center justify-center border-4 border-dashed rounded-2xl inset-0 bg-muted/75">
                    <Layout className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-3xl font-medium">Select a habit to edit</p>
                </div>
            )}
        </form>
    );
};
