import { ListChecks } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLimits } from '@/hooks/use-limits';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { ExerciseListEditor } from './ExerciseListEditor';
import { ExerciseListRail } from './ExerciseListRail';
import { ListFormDialog } from './ListFormDialog';
import { useExerciseLists, type ExerciseListWithItems } from './use-exercise-lists';

type FormState =
    | { mode: 'create' }
    | { mode: 'rename'; list: ExerciseListWithItems };

const ExerciseLists = () => {
    const { t } = useTranslation('lists');
    const {
        lists,
        isLoading,
        isError,
        isSaving,
        createList,
        updateList,
        deleteList,
        reorderLists,
        saveItems,
    } = useExerciseLists();
    const { atListCap, effective } = useLimits();

    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [formState, setFormState] = useState<FormState | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ExerciseListWithItems | null>(null);

    // Derived rather than corrected in an effect: a selection that no longer
    // resolves (the list was just deleted) falls back to the first list on the
    // very same render, so there is never a frame with nothing open.
    const selected = lists.find((list) => list.id === selectedId) ?? lists[0] ?? null;

    const handleFormSubmit = async (values: { name: string; description: string | null }) => {
        if (formState?.mode === 'rename') {
            updateList({ id: formState.list.id, ...values });
            setFormState(null);
            return;
        }

        try {
            const created = await createList(values);
            setSelectedId(created.id);
            setFormState(null);
        } catch {
            // Already surfaced as a toast by the mutation; keep the dialog open so
            // the user can fix the name instead of retyping it.
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground">{t('page.loading')}</div>;
    }

    if (isError) {
        return <div className="p-8 text-center text-destructive">{t('page.error')}</div>;
    }

    return (
        <div className="min-h-screen bg-background p-4 font-sans text-foreground md:p-8">
            <div className="mx-auto max-w-5xl space-y-6">
                <div>
                    <h1 className="flex items-center gap-3 text-3xl font-bold">
                        <ListChecks className="h-8 w-8 text-primary" />
                        {t('page.title')}
                    </h1>
                    <p className="mt-1 text-muted-foreground">{t('page.subtitle')}</p>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <div className="lg:col-span-5">
                        <ExerciseListRail
                            lists={lists}
                            selectedId={selected?.id ?? null}
                            onSelect={setSelectedId}
                            onCreate={() => setFormState({ mode: 'create' })}
                            onRename={(list) => setFormState({ mode: 'rename', list })}
                            onDelete={setDeleteTarget}
                            onReorder={reorderLists}
                            atCap={atListCap}
                            maxLists={effective?.maxExerciseLists ?? null}
                        />
                    </div>

                    <div className="lg:col-span-7">
                        <ExerciseListEditor list={selected} onSaveItems={saveItems} />
                    </div>
                </div>
            </div>

            <ListFormDialog
                open={formState !== null}
                list={formState?.mode === 'rename' ? formState.list : null}
                onClose={() => setFormState(null)}
                onSubmit={handleFormSubmit}
                isSaving={isSaving}
            />

            <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('delete.title', { name: deleteTarget?.name ?? '' })}</AlertDialogTitle>
                        <AlertDialogDescription>{t('delete.body')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('delete.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={() => {
                                if (deleteTarget) deleteList(deleteTarget.id);
                                setDeleteTarget(null);
                            }}
                        >
                            {t('delete.confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default ExerciseLists;
