import * as React from "react";
import { PlusCircle, Globe, User, Layers } from "lucide-react";
import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    Badge,
    AdminPage,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@trackbit/ui";

import { useAdminExercises, AdminExercise, MuscleGroup } from "./use-admin-exercises";
import { ExerciseForm } from "./components/ExerciseForm";
import { MuscleGroupForm } from "./components/MuscleGroupForm";
import { ExerciseTable } from "./components/ExerciseTable";
import { MuscleGroupTable } from "./components/MuscleGroupTable";
import { DeleteConfirm } from "./components/DeleteConfirm";
import { LoadingState } from "./components/LoadingState";

export default function ExercisesPage() {
    const {
        systemExercises,
        userExercises,
        muscleGroups,
        isLoading,
        isMGLoading,
        deleteExercise,
        deleteMuscleGroup,
    } = useAdminExercises();

    // Exercise dialog state
    const [isExFormOpen, setIsExFormOpen] = React.useState(false);
    const [editingExercise, setEditingExercise] = React.useState<AdminExercise | null>(null);
    const [deletingExercise, setDeletingExercise] = React.useState<AdminExercise | null>(null);

    // Muscle group dialog state
    const [isMGFormOpen, setIsMGFormOpen] = React.useState(false);
    const [editingMG, setEditingMG] = React.useState<MuscleGroup | null>(null);
    const [deletingMG, setDeletingMG] = React.useState<MuscleGroup | null>(null);

    const handleEditExercise = React.useCallback((ex: AdminExercise) => setEditingExercise(ex), []);
    const handleDeleteExercise = React.useCallback((ex: AdminExercise) => setDeletingExercise(ex), []);
    const handleEditMG = React.useCallback((mg: MuscleGroup) => setEditingMG(mg), []);
    const handleDeleteMG = React.useCallback((mg: MuscleGroup) => setDeletingMG(mg), []);

    const [activeTab, setActiveTab] = React.useState("system");

    const pageActions = React.useMemo(() => {
        if (activeTab === "muscle-groups") {
            return [
                {
                    label: "Add Muscle Group",
                    icon: <PlusCircle className="h-4 w-4" />,
                    onClick: () => setIsMGFormOpen(true),
                },
            ];
        }
        return [
            {
                label: "Add System Exercise",
                icon: <PlusCircle className="h-4 w-4" />,
                onClick: () => setIsExFormOpen(true),
            },
        ];
    }, [activeTab]);

    return (
        <AdminPage
            title="Exercises"
            description="Manage system-wide exercises and muscle group taxonomy."
            pageActions={pageActions}
        >
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="system" className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        System
                        {!isLoading && (
                            <Badge variant="secondary" className="ml-1 text-xs">
                                {systemExercises.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="user" className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        User Created
                        {!isLoading && (
                            <Badge variant="secondary" className="ml-1 text-xs">
                                {userExercises.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="muscle-groups" className="flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        Muscle Groups
                        {!isMGLoading && (
                            <Badge variant="secondary" className="ml-1 text-xs">
                                {muscleGroups.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <div className="mt-4">
                    <TabsContent value="system">
                        {isLoading ? (
                            <LoadingState label="exercises" />
                        ) : (
                            <ExerciseTable
                                data={systemExercises}
                                onEdit={handleEditExercise}
                                onDelete={handleDeleteExercise}
                            />
                        )}
                    </TabsContent>

                    <TabsContent value="user">
                        {isLoading ? (
                            <LoadingState label="exercises" />
                        ) : (
                            <ExerciseTable
                                data={userExercises}
                                onEdit={handleEditExercise}
                                onDelete={handleDeleteExercise}
                            />
                        )}
                    </TabsContent>

                    <TabsContent value="muscle-groups">
                        {isMGLoading ? (
                            <LoadingState label="muscle groups" />
                        ) : (
                            <MuscleGroupTable
                                data={muscleGroups}
                                onEdit={handleEditMG}
                                onDelete={handleDeleteMG}
                            />
                        )}
                    </TabsContent>
                </div>
            </Tabs>

            {/* ── Exercise Dialogs ── */}
            <Dialog open={isExFormOpen} onOpenChange={setIsExFormOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create System Exercise</DialogTitle>
                    </DialogHeader>
                    <ExerciseForm
                        muscleGroups={muscleGroups}
                        onSuccess={() => setIsExFormOpen(false)}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={!!editingExercise} onOpenChange={(o) => !o && setEditingExercise(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Exercise</DialogTitle>
                    </DialogHeader>
                    {editingExercise && (
                        <ExerciseForm
                            exercise={editingExercise}
                            muscleGroups={muscleGroups}
                            onSuccess={() => setEditingExercise(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <DeleteConfirm
                open={!!deletingExercise}
                name={deletingExercise?.name ?? ""}
                description={`Are you sure you want to delete "${deletingExercise?.name}"? This cannot be undone and will remove it from all user logs.`}
                onConfirm={() => {
                    if (deletingExercise) deleteExercise(deletingExercise.id);
                    setDeletingExercise(null);
                }}
                onCancel={() => setDeletingExercise(null)}
            />

            {/* ── Muscle Group Dialogs ── */}
            <Dialog open={isMGFormOpen} onOpenChange={setIsMGFormOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Create Muscle Group</DialogTitle>
                    </DialogHeader>
                    <MuscleGroupForm
                        allGroups={muscleGroups}
                        onSuccess={() => setIsMGFormOpen(false)}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={!!editingMG} onOpenChange={(o) => !o && setEditingMG(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit Muscle Group</DialogTitle>
                    </DialogHeader>
                    {editingMG && (
                        <MuscleGroupForm
                            muscleGroup={editingMG}
                            allGroups={muscleGroups}
                            onSuccess={() => setEditingMG(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <DeleteConfirm
                open={!!deletingMG}
                name={deletingMG?.name ?? ""}
                onConfirm={() => {
                    if (deletingMG) deleteMuscleGroup(deletingMG.id);
                    setDeletingMG(null);
                }}
                onCancel={() => setDeletingMG(null)}
            />
        </AdminPage>
    );
}
