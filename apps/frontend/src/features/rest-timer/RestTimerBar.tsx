import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Timer } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/utils/utils';
import { useRestTimerStore } from './rest-timer-store';
import { playRestAlert } from './rest-alert';
import {
    ALERT_GRACE_MS, STEP_MS, isExpired, isOver, remainingMs, restText, totalMs, untilNextSecond,
} from './rest-timer';

/**
 * The rest countdown at the foot of every page while it runs: time left, −15s / +15s and Skip;
 * past the end, below zero in red with only Done, until it expires. The time is also in the
 * tab's title, and a beep marks the end. Its label leads back to the session.
 */
export function RestTimerBar() {
    const { rest, adjust, end } = useRestTimerStore();
    const navigate = useNavigate();
    const { t } = useTranslation('tracker');
    const [now, setNow] = useState(Date.now);

    // A new rest (or one from another tab) reads the time at once, not at the next tick.
    useEffect(
        () => useRestTimerStore.subscribe((state, prev) => {
            if (state.rest !== prev.rest) setNow(Date.now());
        }),
        [],
    );

    // Re-read the time as each shown second turns over, until it expires.
    useEffect(() => {
        if (!rest) return;
        const current = Date.now();
        if (isExpired(rest, current)) return end();
        const timeout = setTimeout(() => setNow(Date.now()), untilNextSecond(remainingMs(rest, current)));
        return () => clearTimeout(timeout);
    }, [rest, now, end]);

    // Beep when the end passes while open; not for a rest already over when the page loaded.
    const wasOver = useRef<boolean | null>(null);
    useEffect(() => {
        wasOver.current = null;
    }, [rest?.startedAt, rest?.endsAt]);
    const over = rest != null && isOver(rest, now);
    useEffect(() => {
        if (!rest) return;
        if (wasOver.current === false && over && -remainingMs(rest, now) <= ALERT_GRACE_MS) playRestAlert();
        wasOver.current = over;
    }, [rest, now, over]);

    const text = rest ? restText(remainingMs(rest, now)) : null;
    const title = t(over ? 'rest_over_title' : 'rest_title');

    useEffect(() => {
        if (text == null) return;
        const original = document.title;
        document.title = `${text} ${title} · ${original}`;
        return () => {
            document.title = original;
        };
    }, [text, title]);

    if (!rest || isExpired(rest, now)) return null;
    const total = totalMs(rest);
    const progress = over ? 1 : total > 0 ? remainingMs(rest, now) / total : 0;

    return (
        <div className="sticky bottom-0 z-40 border-t bg-background/95 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(`/sessions?logId=${rest.dayLogId}`)}
                        className={cn('flex min-w-0 items-center gap-2 rounded-md text-left', over && 'text-destructive')}
                        aria-label={t('rest_open_session')}
                    >
                        <Timer className="h-5 w-5 shrink-0" />
                        <span className="truncate text-sm font-medium">{title}</span>
                        <span className="text-2xl font-semibold tabular-nums">{text}</span>
                    </button>
                    <div className="ml-auto flex shrink-0 items-center">
                        {over ? (
                            <Button variant="ghost" size="sm" onClick={end}>{t('rest_done')}</Button>
                        ) : (
                            <>
                                <Button variant="ghost" size="sm" onClick={() => adjust(-STEP_MS)}>{t('rest_minus_15s')}</Button>
                                <Button variant="ghost" size="sm" onClick={() => adjust(STEP_MS)}>{t('rest_plus_15s')}</Button>
                                <Button variant="ghost" size="sm" onClick={end}>{t('rest_skip')}</Button>
                            </>
                        )}
                    </div>
                </div>
                {/* Full and red in overtime. */}
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                        className={cn('h-full transition-[width] duration-1000 ease-linear', over ? 'bg-destructive' : 'bg-primary')}
                        style={{ width: `${progress * 100}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
