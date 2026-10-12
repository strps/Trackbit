import { useState } from 'react';
import {
    Dumbbell, Search, Plus,
    Activity, User, Globe, Info,
    MoreVertical, Trash2, Pencil, Lock
} from 'lucide-react';
import { useExercises } from '../../hooks/use-exercises';
import { useLimits } from '@/hooks/use-limits';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/components/ui/tooltip';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/shared/components/ui/dropdown-menu';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { AddToListMenu } from '@/features/exercise-lists/AddToListMenu';
import type { ExerciseWithLastPerformance } from '../../hooks/use-exercises';
import { ExerciseFormDialog } from './ExerciseForm';
import { useCategoryConfig } from './category-config';
import { ExerciseInfoSheet } from './ExerciseInfoSheet';

const ExerciseLibrary = () => {
    const { t } = useTranslation('exercises');
    const { t: tErrors } = useTranslation('errors');
    const { exercises, isLoading, deleteExercise } = useExercises();
    const { atExerciseCap, effective } = useLimits();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'custom' | 'system'>('all');

    const [isFormOpen, setIsFormOpen] = useState(false);
    // Kept after the dialog closes, so its title doesn't change while it fades out.
    const [editingExercise, setEditingExercise] = useState<ExerciseWithLastPerformance | undefined>();
    const [infoExerciseId, setInfoExerciseId] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ExerciseWithLastPerformance | null>(null);
    const categories = useCategoryConfig();

    const confirmDelete = async (exercise: ExerciseWithLastPerformance) => {
        try {
            await deleteExercise(exercise.id);
        } catch {
            toast.error(t('error.generic_title'), { description: t('error.generic_body') });
        }
    };

    const filteredExercises = exercises.filter(ex => {
        const matchesSearch = ex.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType =
            filterType === 'all' ? true :
                filterType === 'custom' ? !!ex.userId :
                    !ex.userId;
        return matchesSearch && matchesType;
    });



    if (isLoading) return <div className="p-8 text-center text-muted-foreground">{t('page.loading')}</div>;

    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <Dumbbell className="w-8 h-8 text-primary" />
                            {t('page.title')}
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            {t('page.subtitle')}
                        </p>
                    </div>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span>
                                <Button
                                    onClick={() => { if (!atExerciseCap) { setEditingExercise(undefined); setIsFormOpen(true); } }}
                                    disabled={atExerciseCap}
                                    className="font-bold"
                                    size="lg"
                                >
                                    <Plus className="w-4 h-4 mr-2" /> {t('page.add')}
                                </Button>
                            </span>
                        </TooltipTrigger>
                        {atExerciseCap && (
                            <TooltipContent>
                                {t('page.at_cap', { max: effective?.maxCustomExercises ?? 0 })}
                            </TooltipContent>
                        )}
                    </Tooltip>
                </div>

                <ExerciseFormDialog open={isFormOpen} onOpenChange={setIsFormOpen} exercise={editingExercise} />
                <ExerciseInfoSheet exerciseId={infoExerciseId} onClose={() => setInfoExerciseId(null)} />

                {/* Filters & Search */}
                <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-border">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                            type="text"
                            placeholder={t('page.search')}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <div className="flex p-1 bg-muted rounded-lg">
                        {(['all', 'custom', 'system'] as const).map((type) => (
                            <Button
                                key={type}
                                onClick={() => setFilterType(type)}
                                variant={filterType === type ? 'default' : 'ghost'}
                            >
                                {t(`filter.${type}`)}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* List Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredExercises.map((exercise) => {
                        const config = categories.find(c => c.value === exercise.category) || categories[0];
                        const isFrozen = !!exercise.frozen;

                        return (
                            <div
                                key={exercise.id}
                                className={`p-4 bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow ${isFrozen ? 'opacity-60 grayscale' : ''}`}
                                title={isFrozen ? tErrors('limits.frozen_tooltip') : undefined}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <Badge variant="secondary" className={config.color}>
                                        {config.label}
                                    </Badge>
                                    <div className="flex items-center gap-1">
                                        {exercise.userId ? (
                                            <>
                                                {isFrozen && (
                                                    <Badge variant="outline" className="flex items-center gap-1">
                                                        <Lock className="w-3 h-3" /> {tErrors('limits.frozen_badge')}
                                                    </Badge>
                                                )}
                                                <Badge variant="outline" className="flex items-center gap-1">
                                                    <User className="w-3 h-3" /> {t('badge.mine')}
                                                </Badge>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7">
                                                            <MoreVertical className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {!isFrozen && (
                                                            <DropdownMenuItem
                                                                onClick={() => { setEditingExercise(exercise); setIsFormOpen(true); }}
                                                            >
                                                                <Pencil className="w-4 h-4 mr-2" /> {t('menu.edit')}
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive"
                                                            onClick={() => setDeleteTarget(exercise)}
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-2" /> {t('menu.delete')}
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </>
                                        ) : (
                                            <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground">
                                                <Globe className="w-3 h-3" /> {t('badge.system')}
                                            </Badge>
                                        )}
                                        <Button variant="ghost" size="icon" className="h-7 w-7"
                                            onClick={() => setInfoExerciseId(exercise.id)} aria-label={t('info.open')}>
                                            <Info className="w-4 h-4" />
                                        </Button>
                                        <AddToListMenu exerciseId={exercise.id} />
                                    </div>
                                </div>

                                <h3 className="font-bold text-lg mb-1">
                                    <button type="button" className="text-left hover:underline" onClick={() => setInfoExerciseId(exercise.id)}>
                                        {exercise.name}
                                    </button>
                                </h3>

                                <div className="text-sm text-muted-foreground flex items-center gap-2 mb-3">
                                    <Activity className="w-4 h-4" />
                                    <span>
                                        {exercise.muscleGroups.length > 0
                                            ? exercise.muscleGroups.map((m) => m.name).join(', ')
                                            : t('card.general')}
                                    </span>
                                </div>

                                <div className="pt-3 border-t border-border flex gap-2">
                                    {config.fields.map(f => (
                                        <Badge key={f.label} variant="outline" className="text-[10px]">
                                            {f.label}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
                {filteredExercises.length === 0 && (
                    <p className="py-8 text-center text-muted-foreground">{t('page.empty')}</p>
                )}

                <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t('delete.title', { name: deleteTarget?.name ?? '' })}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t('delete.body')}
                                {deleteTarget?.lastPerformance && <> {t('delete.body_logged')}</>}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{t('delete.cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-destructive text-white hover:bg-destructive/90"
                                onClick={() => {
                                    if (deleteTarget) confirmDelete(deleteTarget);
                                    setDeleteTarget(null);
                                }}
                            >
                                {t('delete.confirm')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </div>
        </div>
    );
};

export default ExerciseLibrary;