import { Check, ListPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useExerciseSources } from '@/hooks/use-exercise-sources';
import { Button } from '@/shared/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { useExerciseLists } from './use-exercise-lists';

interface AddToListMenuProps {
    exerciseId: number;
    className?: string;
    align?: 'start' | 'center' | 'end';
}

// The "add this exercise to a list" affordance, dropped anywhere exercises are
// browsed. Targets come from the source descriptors and are gated on
// `capabilities.canAppend` — never on the source's kind — so a frozen list drops
// out on its own and a future source kind needs no change here.
export const AddToListMenu = ({ exerciseId, className, align = 'end' }: AddToListMenuProps) => {
    const { t } = useTranslation('lists');
    const { lists, appendExercise } = useExerciseLists();
    const { sources } = useExerciseSources();

    const targets = sources.flatMap((source) => {
        if (!source.capabilities.canAppend) return [];
        // The kind check is only how we reach `listId`; the gate above is the
        // capability. Appending to a non-list source is meaningless, and the
        // backend already reflects that by leaving canAppend false for them.
        const ref = source.ref;
        if (ref.kind !== 'list') return [];

        const list = lists.find((candidate) => candidate.id === ref.listId);
        return list ? [{ list, name: source.name ?? list.name }] : [];
    });

    return (
        <DropdownMenu>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={className ?? 'h-7 w-7'}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={t('add_to_list.label')}
                        >
                            <ListPlus className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>{t('add_to_list.label')}</TooltipContent>
            </Tooltip>

            <DropdownMenuContent align={align} onClick={(e) => e.stopPropagation()}>
                <DropdownMenuLabel className="text-muted-foreground">
                    {t('add_to_list.label')}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {targets.length === 0 ? (
                    <DropdownMenuItem disabled>{t('add_to_list.empty')}</DropdownMenuItem>
                ) : (
                    targets.map(({ list, name }) => {
                        const alreadyIn = list.items.some((item) => item.exerciseId === exerciseId);
                        return (
                            <DropdownMenuItem
                                key={list.id}
                                disabled={alreadyIn}
                                onClick={() => {
                                    appendExercise({ listId: list.id, exerciseId });
                                    toast.success(t('add_to_list.added', { name }));
                                }}
                            >
                                <span className="flex-1 truncate">{name}</span>
                                {alreadyIn ? (
                                    <Check className="ml-2 h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                        {list.items.length}
                                    </span>
                                )}
                            </DropdownMenuItem>
                        );
                    })
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
