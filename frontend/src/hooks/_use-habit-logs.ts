// import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// import { useExercises } from './use-exercises';

// const API_URL = 'http://localhost:3000/api/logs';

// // --- Types ---
// export interface ExerciseSet {
//     id?: number; // Optional because optimistic sets won't have real IDs yet
//     tempId?: string; // For optimistic keying
//     reps: number;
//     weight: number;
//     exerciseLogId?: number;
// }

// export interface ExerciseLogEntry {
//     id?: number;
//     tempId?: string;
//     exerciseId: number;
//     exerciseSets: ExerciseSet[];
// }

// export interface EnhancedDayLog {
//     habitId: number;
//     date: string;
//     exerciseSessions?: any;
//     rating?: number;
//     notes?: string;
//     // exercises: ExerciseLogEntry[];
// }

// interface HabitWithLogs extends Trackbit.Habit {
//     dayLogs: Record<string, EnhancedDayLog>;
// }

// // --- Fetcher ---
// const fetchHistory = async (): Promise<Record<string, HabitWithLogs>> => {
//     const res = await fetch(`${API_URL}/history`, { credentials: 'include' });
//     if (!res.ok) throw new Error('Failed to fetch history');
//     const data = await res.json();

//     const habitsObj: Record<string, HabitWithLogs> = {};

//     data.forEach((habit: any) => {
//         const dayLogsMap: Record<string, EnhancedDayLog> = {};
//         if (habit.dayLogs) {
//             habit.dayLogs.forEach((dl: any) => {

//                 dayLogsMap[dl.date] = {
//                     habitId: dl.habitId,
//                     date: dl.date,
//                     exerciseSessions: dl.exerciseSessions,
//                     rating: dl.rating,
//                     notes: dl.notes,
//                 };
//             });
//         }
//         habitsObj[habit.id] = { ...habit, dayLogs: dayLogsMap };
//     });
//     return habitsObj;
// };

// export function useHabitLogs() {
//     const queryClient = useQueryClient();
//     const selectedHabitId = 1
//     const selectedDay = ""
//     const selectedSessionIndex: number | null = 0
//     const { exercises } = useExercises();


//     const historyQuery = useQuery({
//         queryKey: ['habit-logs'],
//         queryFn: fetchHistory,
//         staleTime: 1000 * 60 * 5,
//     });

//     const habitsWithLogs = historyQuery.data ?? {};
//     const currentDayLog = (selectedHabitId && selectedDay)
//         ? habitsWithLogs[selectedHabitId]?.dayLogs?.[selectedDay]
//         : undefined;

//     // --- Helper to update cache safely ---
//     const updateCache = (updater: (data: Record<string, HabitWithLogs>) => void) => {
//         queryClient.setQueryData(['habit-logs'], (old: Record<string, HabitWithLogs> | undefined) => {
//             if (!old) return {};
//             const newData = JSON.parse(JSON.stringify(old)); // Deep clone
//             updater(newData);
//             return newData;
//         });
//     };

//     // --- Mutations ---

//     // 0. Log Simple Habit (Restored)
//     const logSimple = useMutation({
//         mutationFn: async (payload: { habitId: number, date: string, value: number }) => {
//             // Map 'value' from UI to 'rating' for Backend
//             const res = await fetch(`${API_URL}/check`, {
//                 method: 'POST',
//                 body: JSON.stringify({
//                     habitId: payload.habitId,
//                     date: payload.date,
//                     rating: payload.value
//                 }),
//                 headers: { 'Content-Type': 'application/json' },
//             });
//             return res.json();
//         },
//         onMutate: async (newItem) => {
//             await queryClient.cancelQueries({ queryKey: ['habit-logs'] });

//             updateCache((newData) => {
//                 const habit = newData[newItem.habitId];
//                 if (habit) {
//                     if (!habit.dayLogs[newItem.date]) {
//                         habit.dayLogs[newItem.date] = {
//                             habitId: newItem.habitId, date: newItem.date, exercises: []
//                         };
//                     }
//                     // Optimistically update rating/value
//                     habit.dayLogs[newItem.date].rating = newItem.value;
//                 }
//             });
//         },
//         onSettled: () => queryClient.invalidateQueries({ queryKey: ['habit-logs'] })
//     });

//     // 1. Create Session
//     const createSession = useMutation({
//         mutationFn: async () => {
//             if (!selectedHabitId || !selectedDay) throw new Error("No context");

//             const res = await fetch(`${API_URL}/exercise-sessions`, {
//                 method: 'POST',
//                 body: JSON.stringify({ habitId: Number(selectedHabitId), date: selectedDay }),
//                 headers: { 'Content-Type': 'application/json' },
//                 credentials: 'include'
//             });
//             return res.json();
//         },
//         onSuccess: (data) => {
//             updateCache((newData) => {
//                 if (!selectedHabitId || !selectedDay) return;

//                 const habit = newData[selectedHabitId];

//                 if (!habit.dayLogs[selectedDay]) {
//                     habit.dayLogs[selectedDay] = {
//                         habitId: selectedHabitId,
//                         date: selectedDay,
//                         exerciseSessions: [{ exerciseLogs: [], ...data }],
//                         rating: 3,
//                     };
//                 } else {
//                     habit.dayLogs[selectedDay].exerciseSessions.push(data);
//                 }
//             });
//         }
//     });

//     // 2. Add Exercise Log
//     const addExerciseLog = useMutation({
//         mutationFn: async (exerciseId: number) => {

//             if (selectedSessionIndex === null) throw new Error("No Active Session");

//             const session = currentDayLog?.exerciseSessions[selectedSessionIndex]

//             const exercise = exercises.find(e => e.id === exerciseId);
//             if (!exercise) throw new Error("Exercise not found");

//             const defaultSet = { reps: exercise.defaultReps || 10, weight: exercise.defaultWeight || 25 };

//             const res = await fetch(`${API_URL}/exercise-log`, {
//                 method: 'POST',
//                 body: JSON.stringify({ sessionId: session.id, exerciseId, exerciseSets: [defaultSet] }),
//                 headers: { 'Content-Type': 'application/json' },
//                 credentials: 'include'
//             });

//             return res.json();
//         },

//         onMutate: async (exerciseId) => {
//             if (!selectedHabitId || !selectedDay) return;
//             const tempId = `temp-${Math.random()}`;
//             //TODO: change the default reps and weight for the exercise logged
//             updateCache((newData) => {

//                 const session = newData[selectedHabitId]?.dayLogs[selectedDay].exerciseSessions[selectedSessionIndex!];
//                 if (session) {

//                     session.exerciseLogs.push({
//                         tempId,
//                         exerciseId,
//                         exerciseSets: [],
//                         weightUnit: 'kg',
//                         distanceUnit: 'km'
//                     });
//                 }
//             });
//             return { tempId };
//         },
//         onSuccess: (data, variables, ctx) => {
//             // Replace temp ID with real ID
//             updateCache((newData) => {
//                 if (!selectedHabitId || !selectedDay) return;
//                 const session = newData[selectedHabitId]?.dayLogs[selectedDay].exerciseSessions[selectedSessionIndex!];
//                 const ex = session?.exerciseLogs.find(e => e.tempId === ctx?.tempId);
//                 if (ex) {
//                     ex.id = data.id;
//                     delete ex.tempId;
//                 }
//             });
//         },
//         onSettled: () => queryClient.invalidateQueries({ queryKey: ['habit-logs'] })
//     });

//     // 3. Remove Exercise Log
//     const removeExerciseLog = useMutation({
//         mutationFn: async (exerciseLogId: number) => {
//             await fetch(`${API_URL}/exercise/${exerciseLogId}`, { method: 'DELETE' });
//         },
//         onMutate: async (id) => {
//             if (!selectedHabitId || !selectedDay) return;
//             updateCache((newData) => {
//                 const log = newData[selectedHabitId]?.dayLogs[selectedDay];
//                 if (log) {
//                     log.exercises = log.exercises.filter(e => e.id !== id);
//                 }
//             });
//         }
//     });

//     // 4. Save Set (Create or Update)
//     const saveSet = useMutation({
//         mutationFn: async (payload: { exerciseLog: ExerciseLogEntry, exerciseSet: ExerciseSet }) => {

//             if (!payload.exerciseSet) {
//                 const exercise = exercises.find(e => e.id === payload.exerciseLog.exerciseId);
//                 if (!exercise) throw new Error("Exercise not found");
//                 payload.exerciseSet = {
//                     reps: exercise.defaultReps || 10,
//                     weight: exercise.defaultWeight || 25
//                 }
//             }

//             const res = await fetch(`${API_URL}/exercise-set`, {
//                 method: 'POST',
//                 body: JSON.stringify({
//                     id: payload.exerciseSet.id,
//                     exerciseLogId: payload.exerciseLog.id,
//                     reps: payload.exerciseSet.reps,
//                     weight: payload.exerciseSet.weight
//                 }),
//                 headers: { 'Content-Type': 'application/json' },
//                 credentials: 'include'
//             });
//             return res.json();
//         },
//         onMutate: async ({ exerciseLog, exerciseSet }) => {
//             if (!selectedHabitId || !selectedDay) return;


//             updateCache((newData) => {
//                 const exerciseSets = newData[selectedHabitId]?.dayLogs[selectedDay].exerciseSessions[selectedSessionIndex!].exerciseLogs.find(e => e.id === exerciseLog.id).exerciseSets;
//                 if (exerciseSets) {
//                     if (exerciseSet?.id) {
//                         // Update
//                         const existing = exerciseSets.find(s => s.id === exerciseSet.id);
//                         if (existing) {
//                             existing.reps = exerciseSet.reps;
//                             existing.weight = exerciseSet.weight;
//                         }
//                     } else {
//                         // Create
//                         const exercise = exercises.find(e => e.id === exerciseLog.exerciseId);
//                         if (!exercise) throw new Error("Exercise not found");
//                         exerciseSet = {
//                             id: -1,
//                             reps: exercise.defaultReps || 10,
//                             weight: exercise.defaultWeight || 25
//                         }
//                         exerciseSets.push(exerciseSet);
//                     }
//                 }
//             });
//             // return { tempId };
//         },
//         onSuccess: (data, { exerciseLog, exerciseSet }, ctx) => {
//             if (!exerciseSet.id) { // If it was a create TODO: this should be updates, as the estrucutre is diferenct: sesions.logs.sets
//                 updateCache((newData) => {
//                     if (!selectedHabitId || !selectedDay || selectedSessionIndex === null) return;
//                     const exerciseSets = newData[selectedHabitId].dayLogs[selectedDay].exerciseSessions[selectedSessionIndex].exerciseLogs.find(e => e.id === exerciseLog.id).exerciseSets;
//                     const exerciseSet = exerciseSets.find(s => s.id === -1);
//                     if (exerciseSet) {
//                         exerciseSet.id = data.id;
//                         exerciseSet.exerciseLogId = exerciseLog.id;
//                     }
//                 });
//             }
//         }
//     });

//     // 5. Delete Set
//     const deleteSet = useMutation({
//         mutationFn: async (exerciseSet: any) => {
//             await fetch(
//                 `${API_URL}/exercise-set/${exerciseSet.id}`,
//                 {
//                     method: 'DELETE',
//                     credentials: 'include'
//                 }
//             );
//         },
//         onMutate: async (exerciseSet) => {
//             const exerciseSession = currentDayLog?.exerciseSessions[selectedSessionIndex!];
//             if (!exerciseSession) return;
//             if (!selectedHabitId || !selectedDay) return;
//             updateCache((newData) => {
//                 const exerciseLog = newData[selectedHabitId]?.dayLogs[selectedDay].exerciseSessions[selectedSessionIndex!].exerciseLogs.find(e => e.id === exerciseSet.exerciseLogId);
//                 if (exerciseLog) {
//                     exerciseLog.exerciseSets = exerciseLog.exerciseSets.filter(s => s.id !== exerciseSet.id);
//                 }
//             });
//         }
//     });

//     return {
//         habitsWithLogs,
//         currentLog: currentDayLog,
//         isLoading: historyQuery.isLoading,
//         selectedSessionIndex: selectedSessionIndex,
//         selectedHabitId: selectedHabitId,
//         selectedDate: selectedDay,
//         logSimple: logSimple.mutate, // Exposed for SimpleHabitPanel
//         createSession: createSession.mutateAsync,
//         addExerciseLog: addExerciseLog.mutate,
//         removeExerciseLog: removeExerciseLog.mutate,
//         saveSet: saveSet.mutate,
//         deleteSet: deleteSet.mutate
//     };
// }