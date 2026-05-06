import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Check, Loader2 } from "lucide-react";
import { Button, Input, Textarea, Label } from "@trackbit/ui";

import { CATEGORY_CONFIG } from "../category-config";
import {
    useAdminExercises,
    AdminExercise,
    ExercisePayload,
    MuscleGroup,
} from "../use-admin-exercises";

const exerciseFormSchema = z.object({
    nameEn: z.string().min(1, "English name is required").trim(),
    nameEs: z.string().optional(),
    category: z.enum(["strength", "cardio", "flexibility"]),
    descriptionEn: z.string().max(500).optional(),
    descriptionEs: z.string().max(500).optional(),
    muscleGroups: z.array(z.number()),
});
type ExerciseFormValues = z.infer<typeof exerciseFormSchema>;

interface ExerciseFormProps {
    exercise?: AdminExercise | null;
    onSuccess: () => void;
    muscleGroups: MuscleGroup[];
}

export function ExerciseForm({ exercise, onSuccess, muscleGroups }: ExerciseFormProps) {
    const { createExercise, isCreating, updateExercise, isUpdating } = useAdminExercises();
    const isEditMode = !!exercise;
    const isSaving = isCreating || isUpdating;

    const form = useForm<ExerciseFormValues>({
        resolver: zodResolver(exerciseFormSchema),
        defaultValues: {
            nameEn: exercise?.nameI18n?.en ?? exercise?.name ?? "",
            nameEs: exercise?.nameI18n?.es ?? "",
            category: (exercise?.category ?? "strength") as ExerciseFormValues["category"],
            descriptionEn: exercise?.descriptionI18n?.en ?? "",
            descriptionEs: exercise?.descriptionI18n?.es ?? "",
            muscleGroups: exercise?.muscleGroups?.map((mg) => mg.id) ?? [],
        },
    });

    const selectedCategory = form.watch("category");
    const selectedMuscleGroups = form.watch("muscleGroups");
    const nameEs = form.watch("nameEs");
    const descriptionEs = form.watch("descriptionEs");

    const toggleMuscleGroup = (id: number) => {
        const current = form.getValues("muscleGroups");
        form.setValue(
            "muscleGroups",
            current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
        );
    };

    const handleSubmit = async (data: ExerciseFormValues) => {
        const payload: ExercisePayload = {
            name: { en: data.nameEn, es: data.nameEs || undefined },
            category: data.category,
            description: (data.descriptionEn || data.descriptionEs)
                ? { en: data.descriptionEn || undefined, es: data.descriptionEs || undefined }
                : null,
            muscleGroups: data.muscleGroups,
        };
        if (isEditMode) {
            await updateExercise({ id: exercise.id, ...payload });
        } else {
            await createExercise(payload);
        }
        form.reset();
        onSuccess();
    };

    return (
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="ex-name-en">Exercise Name (English)</Label>
                        <Input
                            id="ex-name-en"
                            placeholder="e.g. Bulgarian Split Squat"
                            {...form.register("nameEn")}
                        />
                        {form.formState.errors.nameEn && (
                            <p className="text-xs text-destructive">{form.formState.errors.nameEn.message}</p>
                        )}
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="ex-name-es">
                            Exercise Name (Spanish)
                            <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                            id="ex-name-es"
                            placeholder="e.g. Sentadilla búlgara"
                            {...form.register("nameEs")}
                        />
                        {!nameEs && (
                            <p className="text-xs text-amber-500">Missing Spanish translation</p>
                        )}
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="ex-desc-en">Description (English)</Label>
                        <Textarea
                            id="ex-desc-en"
                            placeholder="Optional description..."
                            rows={3}
                            {...form.register("descriptionEn")}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="ex-desc-es">
                            Description (Spanish)
                            <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
                        </Label>
                        <Textarea
                            id="ex-desc-es"
                            placeholder="Descripción opcional..."
                            rows={3}
                            {...form.register("descriptionEs")}
                        />
                        {form.watch("descriptionEn") && !descriptionEs && (
                            <p className="text-xs text-amber-500">Missing Spanish translation</p>
                        )}
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label>Target Muscles</Label>
                    <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto rounded-md border p-2">
                        {muscleGroups.map((mg) => {
                            const selected = selectedMuscleGroups.includes(mg.id);
                            return (
                                <button
                                    key={mg.id}
                                    type="button"
                                    onClick={() => toggleMuscleGroup(mg.id)}
                                    className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-all ${selected
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-background hover:bg-accent border-input"
                                        }`}
                                >
                                    {mg.nameI18n?.en ?? mg.name}
                                </button>
                            );
                        })}
                        {muscleGroups.length === 0 && (
                            <p className="text-xs text-muted-foreground p-2">No muscle groups available.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-1.5">
                <Label>Category</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {CATEGORY_CONFIG.map(({ value, label, icon: Icon, description, fields }) => {
                        const isSelected = selectedCategory === value;
                        return (
                            <button
                                key={value}
                                type="button"
                                onClick={() => form.setValue("category", value)}
                                className={`cursor-pointer p-4 rounded-xl border-2 text-left transition-all ${isSelected ? "border-primary bg-primary/5" : "border-border hover:border-accent"
                                    }`}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div
                                        className={`p-2 rounded-lg ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                            }`}
                                    >
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    {isSelected && <Check className="w-5 h-5 text-primary" />}
                                </div>
                                <h4 className={`font-bold text-sm ${isSelected ? "text-primary" : "text-foreground"}`}>
                                    {label}
                                </h4>
                                <p className="text-xs text-muted-foreground mt-1">{description}</p>
                                <div className="mt-3 pt-2 border-t border-border/50 flex flex-wrap gap-1">
                                    {fields.map((f) => (
                                        <span
                                            key={f.label}
                                            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-muted border border-border text-muted-foreground font-medium"
                                        >
                                            <f.icon className="w-3 h-3" /> {f.label}
                                        </span>
                                    ))}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSaving}>
                {isSaving ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                ) : isEditMode ? (
                    "Update Exercise"
                ) : (
                    "Create System Exercise"
                )}
            </Button>
        </form>
    );
}
