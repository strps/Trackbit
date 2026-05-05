import { use, useEffect } from 'react';
import { Dumbbell } from 'lucide-react';
import { SessionPanel } from './components/SessionPanel';
import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '@/shared/components/EmptyState';
import { useActivityTracker } from './api/useActivityTracker';
import { useActivityTrackerStore } from './store/activityTrackerStore';
import { useTranslation } from 'react-i18next';

const ActivityTracker = () => {
    const [searchParams] = useSearchParams();
    const logId = searchParams.get('logId');

    const { selectLogId: setLogId } = useActivityTrackerStore();

    useEffect(() => {
        const paramLogId = searchParams.get('logId');
        if (paramLogId) setLogId(Number(paramLogId));
    }, [searchParams]);


    const { habitName, sessions, isLoading, createSession } = useActivityTracker();
    const { t } = useTranslation('tracker');

    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground">{t('activity_loading')}</div>;
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Dumbbell className="w-8 h-8 text-primary" />
                        {habitName}
                    </h1>
                </div>

                {/* Session content */}
                {(!sessions || sessions.length === 0) ? (
                    <EmptyState
                        onClick={() => createSession()}
                        title={t('activity_no_sessions_title')}
                        description={t('activity_no_sessions_desc')}
                    />
                ) : (
                    <div className="space-y-6">
                        {sessions.map((session, i) => (
                            <SessionPanel key={i} session={session} index={i} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivityTracker;

