import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import type { ExerciseRecentLog } from '@trackbit/types';
import { useExercises, type ExerciseWithLastPerformance } from '@/hooks/use-exercises';
import { useIsDesktop } from '@/hooks/use-media-query';
import { useUnitSystem } from '@/providers/unit-system-provider';
import { formatNumber, kgToDisplay, weightUnit } from '@/shared/utils/intlFormatter';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/shared/components/ui/drawer';
import { formatDuration } from '@/features/activity-tracker/utils';
import { getExerciseFamily } from './exercise-family';
import { ExerciseFormDialog } from './ExerciseForm';
import { useCategoryConfig } from './category-config';

type ExerciseInfoSheetProps = {
    /** The exercise to show; null when closed. */
    exerciseId: number | null;
    onClose: () => void;
    /** The log it was opened from, which "Last time" skips: that's this time, not the last. */
    openedFromLogUuid?: string;
};

/**
 * What an exercise is: its main information, then its instructions, then everything else that
 * helps while doing it. A dialog on desktop, a bottom drawer on mobile. Its variants open in the
 * same sheet, with a way back.
 */
export function ExerciseInfoSheet({ exerciseId, onClose, openedFromLogUuid }: ExerciseInfoSheetProps) {
    const { t } = useTranslation('exercises');
    const isDesktop = useIsDesktop();
    const { exercises } = useExercises();
    // The exercise opened last is kept while the sheet closes, so it doesn't change as it fades out.
    const [rootId, setRootId] = useState(exerciseId);
    // The variants opened from it, in order.
    const [trail, setTrail] = useState<number[]>([]);
    const [previousId, setPreviousId] = useState(exerciseId);
    if (exerciseId !== previousId) {
        setPreviousId(exerciseId);
        if (exerciseId !== null) {
            setRootId(exerciseId);
            setTrail([]);
        }
    }

    const shownId = trail[trail.length - 1] ?? rootId;
    const exercise = exercises.find((e) => e.id === shownId);
    const open = exerciseId !== null;
    const onOpenChange = (next: boolean) => {
        if (!next) onClose();
    };

    const back = trail.length > 0 && (
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setTrail(trail.slice(0, -1))}
            aria-label={t('info.back')}>
            <ArrowLeft className="h-4 w-4" />
        </Button>
    );
    const title = exercise?.name ?? t('info.not_found');
    const body = exercise
        ? <ExerciseInfo exercise={exercise} catalog={exercises} openedFromLogUuid={openedFromLogUuid}
            onOpenVariant={(id) => setTrail([...trail, id])} />
        : null;

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                {/* Not onto the first button: that can be a variant chip at the bottom, scrolling the sheet down. */}
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <div className="flex items-center gap-2">
                            {back}
                            <DialogTitle>{title}</DialogTitle>
                        </div>
                        <DialogDescription className="sr-only">{t('info.description')}</DialogDescription>
                    </DialogHeader>
                    {body}
                </DialogContent>
            </Dialog>
        );
    }
    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <DrawerHeader className="text-left">
                    <div className="flex items-center gap-2">
                        {back}
                        <DrawerTitle className="text-lg">{title}</DrawerTitle>
                    </div>
                    <DrawerDescription className="sr-only">{t('info.description')}</DrawerDescription>
                </DrawerHeader>
                <div className="overflow-y-auto px-4 pb-6">{body}</div>
            </DrawerContent>
        </Drawer>
    );
}

type ExerciseInfoProps = {
    exercise: ExerciseWithLastPerformance;
    catalog: ExerciseWithLastPerformance[];
    openedFromLogUuid?: string;
    onOpenVariant: (id: number) => void;
};

function ExerciseInfo({ exercise, catalog, openedFromLogUuid, onOpenVariant }: ExerciseInfoProps) {
    const { t } = useTranslation('exercises');
    const categories = useCategoryConfig();
    const [editing, setEditing] = useState(false);
    const category = categories.find((c) => c.value === exercise.category);
    const primary = exercise.muscleGroups.filter((m) => m.role === 'primary');
    const secondary = exercise.muscleGroups.filter((m) => m.role === 'secondary');
    const lastLog = exercise.recentLogs.find((log) => log.uuid !== openedFromLogUuid);
    const family = getExerciseFamily(exercise, catalog);
    // Only the user's own exercises are theirs to edit (and not while frozen).
    const editable = !!exercise.userId && !exercise.frozen;

    return (
        <div className="flex flex-col gap-6 text-sm">
            {/* Main */}
            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                    {category && <Badge variant="secondary" className={category.color}>{category.label}</Badge>}
                    {exercise.difficulty && <Badge variant="outline">{t(`difficulty.${exercise.difficulty}`)}</Badge>}
                </div>
                {exercise.muscleGroups.length > 0 && (
                    <InfoRow label={t('info.muscles')}>
                        <div className="flex flex-wrap gap-1">
                            {primary.map((m) => <Badge key={m.id} variant="secondary">{m.name}</Badge>)}
                            {secondary.map((m) => <Badge key={m.id} variant="outline" className="text-muted-foreground">{m.name}</Badge>)}
                        </div>
                    </InfoRow>
                )}
                {exercise.equipment.length > 0 && (
                    <InfoRow label={t('info.equipment')}>
                        {exercise.equipment.map((e) => t(`equipment.${e}`)).join(', ')}
                    </InfoRow>
                )}
            </div>

            {/* Instructions */}
            <Section title={t('info.instructions')}>
                {exercise.instructions ? (
                    <ol className="list-decimal space-y-1 pl-5">
                        {exercise.instructions.map((step, i) => <li key={i}>{step}</li>)}
                    </ol>
                ) : (
                    <p className="text-muted-foreground">
                        {t('info.no_instructions')}
                        {editable && (
                            <> <Button variant="link" className="h-auto p-0" onClick={() => setEditing(true)}>
                                {t('info.add_instructions')}
                            </Button></>
                        )}
                    </p>
                )}
            </Section>

            {/* Other information */}
            <Section title={t('info.other')}>
                <div className="flex flex-col gap-4">
                    <InfoRow label={t('info.last_time')}>
                        {lastLog ? <LastLog log={lastLog} /> : <span className="text-muted-foreground">{t('info.never_performed')}</span>}
                    </InfoRow>
                    {exercise.tips && <BulletList label={t('info.tips')} items={exercise.tips} />}
                    {exercise.commonMistakes && <BulletList label={t('info.common_mistakes')} items={exercise.commonMistakes} />}
                    {exercise.description && (
                        <InfoRow label={t('info.about')}>
                            <p className="whitespace-pre-line">{exercise.description}</p>
                        </InfoRow>
                    )}
                    {family.length > 0 && (
                        <InfoRow label={t('info.variants')}>
                            <div className="flex flex-wrap gap-2">
                                {family.map((e) => (
                                    <Button key={e.id} variant="outline" size="sm" className="rounded-full" onClick={() => onOpenVariant(e.id)}>
                                        {e.name}
                                    </Button>
                                ))}
                            </div>
                        </InfoRow>
                    )}
                </div>
            </Section>

            {editable && <ExerciseFormDialog open={editing} onOpenChange={setEditing} exercise={exercise} />}
        </div>
    );
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
    <section className="flex flex-col gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {children}
    </section>
);

const InfoRow = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="flex flex-col gap-1">
        <span className="font-medium">{label}</span>
        {children}
    </div>
);

const BulletList = ({ label, items }: { label: string; items: string[] }) => (
    <InfoRow label={label}>
        <ul className="list-disc space-y-1 pl-5">
            {items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
    </InfoRow>
);

/** The day of [log] and its sets, one per line. */
function LastLog({ log }: { log: ExerciseRecentLog }) {
    const { t, i18n } = useTranslation('exercises');
    const { unitSystem } = useUnitSystem();
    const [year, month, day] = log.localDay.split('-').map(Number);
    const date = new Date(year, month - 1, day).toLocaleDateString(i18n.language, { dateStyle: 'medium' });

    const describe = (set: ExerciseRecentLog['sets'][number]) => [
        set.reps != null && t('info.set_reps', { count: set.reps }),
        set.weight != null && `${formatNumber(kgToDisplay(set.weight, unitSystem), i18n.language)} ${weightUnit(unitSystem)}`,
        set.duration != null && formatDuration(set.duration / 1000),
        set.distance != null && t('info.set_distance_km', { distance: formatNumber(set.distance, i18n.language) }),
        set.rpe != null && t('info.set_rpe', { rpe: set.rpe }),
    ].filter(Boolean).join(' · ');

    return (
        <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">{date}</span>
            <ol className="space-y-0.5">
                {log.sets.map((set, i) => (
                    <li key={i} className="flex gap-2">
                        <span className="w-12 shrink-0 text-muted-foreground">{t('info.set_number', { n: i + 1 })}</span>
                        <span>{describe(set) || '-'}</span>
                    </li>
                ))}
            </ol>
        </div>
    );
}
