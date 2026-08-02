import React, { useMemo, useState } from 'react';
import { useExercises } from '@/hooks/use-exercises';
import { Button } from '@/shared/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/components/ui/popover';
import { Input } from '@/shared/components/ui/input';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Label } from '@/shared/components/ui/label';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/components/ui/tooltip';
import { Plus, Play, ChevronDown, Search } from 'lucide-react';
import { Exercise } from '@trackbit/types';
import { AddToListMenu } from '@/features/exercise-lists/AddToListMenu';
import { useActivityTracker } from '../api/useActivityTracker';
import { useTranslation } from 'react-i18next';

export const ExercisePicker = ({ sessionId, setEditing }: { sessionId: number; setEditing: () => void }) => {
    const { exercises } = useExercises();

    const { addExerciseLog } = useActivityTracker();

    const { t } = useTranslation('tracker');
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(0);

    const handleAddExerciseLog = (exerciseId: number) => {
        const exercise = exercises.find((e: any) => e.id === exerciseId);
        addExerciseLog({
            exerciseSessionId: sessionId,
            exerciseId,
            // lastPerformance: exercise?.lastPerformance,
        });
        setEditing();
        setOpen(false);
        setSearch('');
    };

    const filtered = useMemo(
        () => exercises.filter((e: any) => e.name.toLowerCase().includes(search.toLowerCase())),
        [exercises, search],
    );

    return (
        <div className="w-min flex items-stretch rounded-l-xl rounded-r-[3rem] border-2 border-primary bg-card p-4 shadow-sm">
            <div className="flex items-center gap-4">
                <div className="flex flex-col gap-2">
                    <Label className="text-xs text-muted-foreground ml-2">{t('activity_recommended')}</Label>
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-48 justify-between">
                                <span className="truncate">
                                    {exercises.length > 0 ? exercises[selected].name : t('activity_select_exercise')}
                                </span>
                                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            className="w-72 p-0"
                            align="start"
                            sideOffset={5}
                            onOpenAutoFocus={(e) => e.preventDefault()}
                            // The add-to-list menu portals to the body, so clicking it
                            // reads as an interaction outside this popover and would
                            // otherwise close the exercise list out from under it.
                            onPointerDownOutside={(e) => {
                                const target = e.detail.originalEvent.target as HTMLElement | null;
                                if (target?.closest('[data-radix-menu-content]')) e.preventDefault();
                            }}
                        >
                            <div className="border-b border-border p-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder={t('activity_search_exercises')}
                                        className="pl-10 bg-background"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                            <ScrollArea className="h-72">
                                <div className="p-2 flex flex-col gap-1">
                                    {filtered.length === 0 ? (
                                        <div className="py-8 text-center">
                                            <p className="text-sm text-muted-foreground">{t('activity_no_exercises_found')}</p>
                                            <Button variant="link" size="sm" className="mt-2">
                                                {t('activity_create_exercise', { name: search })}
                                            </Button>
                                        </div>
                                    ) : (
                                        filtered.map((ex: Exercise) => {
                                            const isTheSelected = ex.id === exercises[selected].id;
                                            return (
                                                <div
                                                    key={ex.id}
                                                    className={`flex w-full items-center rounded-md pr-1 hover:bg-accent transition-colors ${isTheSelected ? 'ring ring-primary' : ''}`}
                                                >
                                                    <button
                                                        onClick={() => {
                                                            handleAddExerciseLog(ex.id);
                                                            const idx = exercises.findIndex((e: Exercise) => e.id === ex.id);
                                                            setSelected((idx + 1) % exercises.length);
                                                        }}
                                                        className="flex min-w-0 flex-1 items-center justify-between px-3 py-2.5 text-left text-sm"
                                                    >
                                                        <div className="flex min-w-0 flex-col">
                                                            <span className="truncate font-medium">{ex.name}</span>
                                                            <span className="text-xs text-muted-foreground uppercase">{ex.category}</span>
                                                        </div>
                                                        <Plus className="h-4 w-4 text-muted-foreground transition-opacity" />
                                                    </button>
                                                    <AddToListMenu exerciseId={ex.id} />
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </ScrollArea>
                        </PopoverContent>
                    </Popover>
                </div>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            onClick={() => {
                                handleAddExerciseLog(exercises[selected].id);
                                setSelected((prev) => (prev + 1) % exercises.length);
                            }}
                            className="flex justify-center items-center w-15 h-15 rounded-full aspect-square"
                        >
                            <Play className="w-full" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{t('activity_add_recommended')}</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
};
