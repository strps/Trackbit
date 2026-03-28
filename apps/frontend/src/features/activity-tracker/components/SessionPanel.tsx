import { Dumbbell, MoreVertical, Trash2 } from 'lucide-react';
import { EmptyState } from '@/shared/components/EmptyState';
import { OptimisticExerciseSession } from '@/features/tracker/use-tracker';
import { AddExercisePicker } from './AddExercisePicker';
import { ExerciseLogCard } from './ExerciseLogCard';
import React, { useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Button } from '@/shared/components/ui/button';
import { useActivityTracker } from '../api/useActivityTracker';

export interface SessionCardProps {
    session: OptimisticExerciseSession;
    index: number;
}

export const SessionPanel = ({ session, index }: SessionCardProps) => {
    const { deleteSession } = useActivityTracker();
    const exerciseLogs = session.exerciseLogs || [];
    const [selectedExerciseLogIndex, setSelectedExerciseLogIndex] = useState<number | null>(null);

    return (
        <div className="bg-card text-card-foreground flex flex-col item gap-6 py-6 shadow-lg">
            <div className="flex justify-between items-center pb-4 px-4 border-b border-border">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Dumbbell className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm text-foreground">Workout Session</h3>
                        <div className="flex items-center gap-2 h-4">
                            <span className="text-xs text-muted-foreground" />
                        </div>
                    </div>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreVertical className="w-5 h-5 text-muted-foreground" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => deleteSession(session.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="overflow-y-auto px-4 space-y-4">
                {exerciseLogs.length === 0 ? (
                    <EmptyState
                        title="Empty Session"
                        description="Add your first exercise to start tracking."
                    />
                ) : (
                    exerciseLogs.map((exerciseLog, i) => (
                        <ExerciseLogCard
                            key={i}
                            exerciseLog={exerciseLog}
                            index={i}
                            isSelected={i === selectedExerciseLogIndex}
                            setEditing={setSelectedExerciseLogIndex}
                        />
                    ))
                )}

                <div className="flex justify-end">
                    <AddExercisePicker sessionId={session.id} setEditing={() => setSelectedExerciseLogIndex(exerciseLogs.length)} />
                </div>
            </div>
        </div>
    );
};
