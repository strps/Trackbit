import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";
import {
    Button,
    Input,
    Textarea,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@trackbit/ui";

import {
    useAdminExercises,
    MuscleGroup,
    MuscleGroupPayload,
} from "../use-admin-exercises";

const mgFormSchema = z.object({
    nameEn: z.string().min(1, "English name is required").trim(),
    nameEs: z.string().optional(),
    descriptionEn: z.string().optional(),
    descriptionEs: z.string().optional(),
    parentId: z.number().nullable().optional(),
});
type MGFormValues = z.infer<typeof mgFormSchema>;

interface MGFormProps {
    muscleGroup?: MuscleGroup | null;
    allGroups: MuscleGroup[];
    onSuccess: () => void;
}

export function MuscleGroupForm({ muscleGroup, allGroups, onSuccess }: MGFormProps) {
    const { createMuscleGroup, isCreatingMG, updateMuscleGroup, isUpdatingMG } = useAdminExercises();
    const isEditMode = !!muscleGroup;
    const isSaving = isCreatingMG || isUpdatingMG;

    const form = useForm<MGFormValues>({
        resolver: zodResolver(mgFormSchema),
        defaultValues: {
            nameEn: muscleGroup?.nameI18n?.en ?? muscleGroup?.name ?? "",
            nameEs: muscleGroup?.nameI18n?.es ?? "",
            descriptionEn: muscleGroup?.descriptionI18n?.en ?? "",
            descriptionEs: muscleGroup?.descriptionI18n?.es ?? "",
            parentId: muscleGroup?.parentId ?? null,
        },
    });

    const nameEs = form.watch("nameEs");
    const descriptionEn = form.watch("descriptionEn");
    const descriptionEs = form.watch("descriptionEs");

    const handleSubmit = async (data: MGFormValues) => {
        const payload: MuscleGroupPayload = {
            name: { en: data.nameEn, es: data.nameEs || undefined },
            description: (data.descriptionEn || data.descriptionEs)
                ? { en: data.descriptionEn || undefined, es: data.descriptionEs || undefined }
                : null,
            parentId: data.parentId ?? null,
        };
        if (isEditMode) {
            await updateMuscleGroup({ id: muscleGroup.id, ...payload });
        } else {
            await createMuscleGroup(payload);
        }
        form.reset();
        onSuccess();
    };

    // Only top-level groups can be parents (avoid deep nesting)
    const topLevelGroups = allGroups.filter((g) => !g.parentId && g.id !== muscleGroup?.id);

    return (
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-2">
            <div className="space-y-1.5">
                <Label htmlFor="mg-name-en">Name (English)</Label>
                <Input id="mg-name-en" placeholder="e.g. Upper Chest" {...form.register("nameEn")} />
                {form.formState.errors.nameEn && (
                    <p className="text-xs text-destructive">{form.formState.errors.nameEn.message}</p>
                )}
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="mg-name-es">
                    Name (Spanish)
                    <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
                </Label>
                <Input id="mg-name-es" placeholder="e.g. Pecho superior" {...form.register("nameEs")} />
                {!nameEs && (
                    <p className="text-xs text-amber-500">Missing Spanish translation</p>
                )}
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="mg-parent">Parent Group (optional)</Label>
                <Select
                    value={form.watch("parentId")?.toString() ?? "none"}
                    onValueChange={(val) =>
                        form.setValue("parentId", val === "none" ? null : parseInt(val, 10))
                    }
                >
                    <SelectTrigger id="mg-parent">
                        <SelectValue placeholder="No parent (top-level)" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">No parent (top-level)</SelectItem>
                        {topLevelGroups.map((g) => (
                            <SelectItem key={g.id} value={g.id.toString()}>
                                {g.nameI18n?.en ?? g.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="mg-desc-en">Description (English)</Label>
                <Textarea
                    id="mg-desc-en"
                    placeholder="Optional description..."
                    rows={2}
                    {...form.register("descriptionEn")}
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="mg-desc-es">
                    Description (Spanish)
                    <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                    id="mg-desc-es"
                    placeholder="Descripción opcional..."
                    rows={2}
                    {...form.register("descriptionEs")}
                />
                {descriptionEn && !descriptionEs && (
                    <p className="text-xs text-amber-500">Missing Spanish translation</p>
                )}
            </div>

            <Button type="submit" className="w-full" disabled={isSaving}>
                {isSaving ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                ) : isEditMode ? (
                    "Update Muscle Group"
                ) : (
                    "Create Muscle Group"
                )}
            </Button>
        </form>
    );
}
