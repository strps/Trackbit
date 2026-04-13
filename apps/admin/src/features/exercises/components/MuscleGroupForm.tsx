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
    name: z.string().min(1, "Name is required").trim(),
    description: z.string().optional(),
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
            name: muscleGroup?.name ?? "",
            description: muscleGroup?.description ?? "",
            parentId: muscleGroup?.parentId ?? null,
        },
    });

    const handleSubmit = async (data: MGFormValues) => {
        const payload: MuscleGroupPayload = {
            name: data.name,
            description: data.description || null,
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
                <Label htmlFor="mg-name">Name</Label>
                <Input id="mg-name" placeholder="e.g. Upper Chest" {...form.register("name")} />
                {form.formState.errors.name && (
                    <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
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
                                {g.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="mg-desc">Description</Label>
                <Textarea
                    id="mg-desc"
                    placeholder="Optional description..."
                    rows={3}
                    {...form.register("description")}
                />
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
