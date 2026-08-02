import { useEffect, useMemo, useState } from "react";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    Input,
    Label,
    Checkbox,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@trackbit/ui";
import { Loader2, Plus, Save, Trash2, Undo2 } from "lucide-react";
import {
    HABIT_TYPES,
    HabitType,
    type AdminLimits,
    useAdminLimits,
} from "./use-admin-limits";

interface RowDraft {
    maxHabits: string;
    maxCustomExercises: string;
    maxExerciseLists: string;
    allowedHabitTypes: HabitType[];
}

function toDraft(limits: AdminLimits): RowDraft {
    return {
        maxHabits: limits.maxHabits == null ? "" : String(limits.maxHabits),
        maxCustomExercises: limits.maxCustomExercises == null ? "" : String(limits.maxCustomExercises),
        maxExerciseLists: limits.maxExerciseLists == null ? "" : String(limits.maxExerciseLists),
        allowedHabitTypes: (limits.allowedHabitTypes ?? []).filter(
            (t): t is HabitType => (HABIT_TYPES as readonly string[]).includes(t)
        ),
    };
}

function draftsEqual(a: RowDraft, b: RowDraft): boolean {
    if (a.maxHabits !== b.maxHabits) return false;
    if (a.maxCustomExercises !== b.maxCustomExercises) return false;
    if (a.maxExerciseLists !== b.maxExerciseLists) return false;
    if (a.allowedHabitTypes.length !== b.allowedHabitTypes.length) return false;
    const sortedA = [...a.allowedHabitTypes].sort();
    const sortedB = [...b.allowedHabitTypes].sort();
    return sortedA.every((v, i) => v === sortedB[i]);
}

function parseIntOrNull(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isInteger(n) && n >= 0 ? n : null;
}

interface LimitsCardProps {
    limits: AdminLimits;
    onSave: (patch: { maxHabits: number | null; maxCustomExercises: number | null; maxExerciseLists: number | null; allowedHabitTypes: HabitType[] }) => void;
    onDelete: () => void;
    isSaving: boolean;
    isDeleting: boolean;
}

function LimitsCard({ limits, onSave, onDelete, isSaving, isDeleting }: LimitsCardProps) {
    const initial = useMemo(() => toDraft(limits), [limits]);
    const [draft, setDraft] = useState<RowDraft>(initial);
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        setDraft(initial);
    }, [initial]);

    const isDirty = !draftsEqual(draft, initial);

    const handleToggleType = (type: HabitType) => {
        setDraft((d) => ({
            ...d,
            allowedHabitTypes: d.allowedHabitTypes.includes(type)
                ? d.allowedHabitTypes.filter((t) => t !== type)
                : [...d.allowedHabitTypes, type],
        }));
    };

    const handleSave = () => {
        onSave({
            maxHabits: parseIntOrNull(draft.maxHabits),
            maxCustomExercises: parseIntOrNull(draft.maxCustomExercises),
            maxExerciseLists: parseIntOrNull(draft.maxExerciseLists),
            allowedHabitTypes: draft.allowedHabitTypes,
        });
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                    <CardTitle className="capitalize">{limits.role}</CardTitle>
                    <CardDescription>Limits applied to users with the “{limits.role}” role.</CardDescription>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setConfirmDelete(true)}
                    disabled={isDeleting}
                    aria-label={`Delete ${limits.role} limits`}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor={`max-habits-${limits.role}`}>Max habits</Label>
                        <Input
                            id={`max-habits-${limits.role}`}
                            type="number"
                            min={0}
                            placeholder="Unlimited"
                            value={draft.maxHabits}
                            onChange={(e) => setDraft({ ...draft, maxHabits: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">Leave blank for unlimited.</p>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor={`max-exercises-${limits.role}`}>Max custom exercises</Label>
                        <Input
                            id={`max-exercises-${limits.role}`}
                            type="number"
                            min={0}
                            placeholder="Unlimited"
                            value={draft.maxCustomExercises}
                            onChange={(e) => setDraft({ ...draft, maxCustomExercises: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">Leave blank for unlimited.</p>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor={`max-lists-${limits.role}`}>Max exercise lists</Label>
                        <Input
                            id={`max-lists-${limits.role}`}
                            type="number"
                            min={0}
                            placeholder="Unlimited"
                            value={draft.maxExerciseLists}
                            onChange={(e) => setDraft({ ...draft, maxExerciseLists: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">Leave blank for unlimited.</p>
                    </div>
                </div>

                <div className="grid gap-2">
                    <Label>Allowed habit types</Label>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                        {HABIT_TYPES.map((type) => (
                            <div key={type} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`${limits.role}-${type}`}
                                    checked={draft.allowedHabitTypes.includes(type)}
                                    onCheckedChange={() => handleToggleType(type)}
                                />
                                <Label htmlFor={`${limits.role}-${type}`} className="capitalize font-normal">
                                    {type}
                                </Label>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                    <Button onClick={handleSave} disabled={!isDirty || isSaving} className="gap-2">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {isSaving ? "Saving..." : "Save changes"}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setDraft(initial)}
                        disabled={!isDirty || isSaving}
                        className="gap-2"
                    >
                        <Undo2 className="h-4 w-4" /> Discard
                    </Button>
                </div>
            </CardContent>

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete limits for “{limits.role}”?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This removes the limits row for this role. Users with this role will fall back to the
                            secure defaults applied to unconfigured roles. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}

interface CreateRoleDialogProps {
    existingRoles: string[];
    onCreate: (input: { role: string; maxHabits: number | null; maxCustomExercises: number | null; maxExerciseLists: number | null; allowedHabitTypes: HabitType[] }) => void;
    isCreating: boolean;
}

function CreateRoleDialog({ existingRoles, onCreate, isCreating }: CreateRoleDialogProps) {
    const [open, setOpen] = useState(false);
    const [role, setRole] = useState("");
    const [maxHabits, setMaxHabits] = useState("");
    const [maxCustomExercises, setMaxCustomExercises] = useState("");
    const [maxExerciseLists, setMaxExerciseLists] = useState("");
    const [allowedHabitTypes, setAllowedHabitTypes] = useState<HabitType[]>(["count", "complex"]);

    const reset = () => {
        setRole("");
        setMaxHabits("");
        setMaxCustomExercises("");
        setMaxExerciseLists("");
        setAllowedHabitTypes(["count", "complex"]);
    };

    const trimmedRole = role.trim();
    const isDuplicate = existingRoles.includes(trimmedRole);
    const canSubmit = trimmedRole.length > 0 && !isDuplicate && !isCreating;

    const handleToggleType = (type: HabitType) => {
        setAllowedHabitTypes((prev) =>
            prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
        );
    };

    const handleSubmit = () => {
        if (!canSubmit) return;
        onCreate({
            role: trimmedRole,
            maxHabits: parseIntOrNull(maxHabits),
            maxCustomExercises: parseIntOrNull(maxCustomExercises),
            maxExerciseLists: parseIntOrNull(maxExerciseLists),
            allowedHabitTypes,
        });
        setOpen(false);
        reset();
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) reset();
            }}
        >
            <Button onClick={() => setOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Add role
            </Button>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add role limits</DialogTitle>
                    <DialogDescription>Define limits for a new role.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="new-role">Role</Label>
                        <Input
                            id="new-role"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            placeholder="e.g. premium"
                        />
                        {isDuplicate && (
                            <p className="text-xs text-destructive">A row for this role already exists.</p>
                        )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="new-max-habits">Max habits</Label>
                            <Input
                                id="new-max-habits"
                                type="number"
                                min={0}
                                placeholder="Unlimited"
                                value={maxHabits}
                                onChange={(e) => setMaxHabits(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="new-max-exercises">Max custom exercises</Label>
                            <Input
                                id="new-max-exercises"
                                type="number"
                                min={0}
                                placeholder="Unlimited"
                                value={maxCustomExercises}
                                onChange={(e) => setMaxCustomExercises(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="new-max-lists">Max exercise lists</Label>
                            <Input
                                id="new-max-lists"
                                type="number"
                                min={0}
                                placeholder="Unlimited"
                                value={maxExerciseLists}
                                onChange={(e) => setMaxExerciseLists(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label>Allowed habit types</Label>
                        <div className="flex flex-wrap gap-x-6 gap-y-2">
                            {HABIT_TYPES.map((type) => (
                                <div key={type} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`new-${type}`}
                                        checked={allowedHabitTypes.includes(type)}
                                        onCheckedChange={() => handleToggleType(type)}
                                    />
                                    <Label htmlFor={`new-${type}`} className="capitalize font-normal">
                                        {type}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
                        {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Create
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function LimitsSection() {
    const { limits, isLoading, error, create, isCreating, update, isUpdating, remove, isDeleting } = useAdminLimits();

    const existingRoles = useMemo(() => limits.map((l) => l.role), [limits]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    Per-role caps on habits, custom exercises, exercise lists, and allowed habit types. Roles
                    without a row use a secure default.
                </div>
                <CreateRoleDialog
                    existingRoles={existingRoles}
                    onCreate={(input) => create(input)}
                    isCreating={isCreating}
                />
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading limits...
                </div>
            ) : error ? (
                <p className="text-sm text-destructive">Failed to load limits. Please try again.</p>
            ) : limits.length === 0 ? (
                <Card>
                    <CardContent className="py-10 text-center text-muted-foreground">
                        No role limits defined yet.
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {limits.map((row) => (
                        <LimitsCard
                            key={row.id}
                            limits={row}
                            onSave={(patch) => update({ role: row.role, ...patch })}
                            onDelete={() => remove(row.role)}
                            isSaving={isUpdating}
                            isDeleting={isDeleting}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
