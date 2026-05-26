import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { logHabit } from "@/lib/habits-api";
import {
  getHistory,
  createExerciseSession,
  deleteExerciseSession,
  addExerciseLog,
  removeExerciseLog,
  createPerformance,
  updatePerformance,
  deletePerformance,
  getExercises,
  type HabitWithHistory,
  type ExerciseInfo,
  type ExerciseLog,
  type CreatePerformanceInput,
  type UpdatePerformanceInput,
} from "@/lib/tracker-api";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const trackerHistoryKey = ["tracker-history"] as const;
export const exercisesKey = ["exercises"] as const;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Derived type
// ---------------------------------------------------------------------------

/** ExerciseLog with its ExerciseInfo resolved from the catalog. */
export type EnrichedExerciseLog = ExerciseLog & {
  exercise: ExerciseInfo | null;
};

// ---------------------------------------------------------------------------
// Cache patch helper — deep-clones the history array and lets the caller
// mutate the clone in-place before it becomes the new query data.
// ---------------------------------------------------------------------------

function patchHistory(
  old: HabitWithHistory[] | undefined,
  patcher: (history: HabitWithHistory[]) => void,
): HabitWithHistory[] {
  if (!old) return [];
  const next = structuredClone(old);
  patcher(next);
  return next;
}

// ---------------------------------------------------------------------------
// Data fetch hooks
// ---------------------------------------------------------------------------

export function useTodayHistory() {
  const { token } = useAuth();
  const today = todayStr();

  return useQuery<HabitWithHistory[]>({
    queryKey: [...trackerHistoryKey, today],
    queryFn: () => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return getHistory(token!, tz, today, today);
    },
    enabled: token !== null,
    staleTime: 1000 * 60 * 5,
  });
}

export function useExercises() {
  const { token } = useAuth();

  return useQuery<ExerciseInfo[]>({
    queryKey: exercisesKey,
    queryFn: () => getExercises(token!),
    enabled: token !== null,
    staleTime: 1000 * 60 * 10,
  });
}

// ---------------------------------------------------------------------------
// Selector hooks — read from cached history without extra network requests
// ---------------------------------------------------------------------------

/**
 * Returns a specific habit's today DayLog and sessions, derived from
 * useTodayHistory() so no extra request is made.
 */
export function useHabitTodayLog(habitId: number) {
  const query = useTodayHistory();
  const habit = (query.data ?? []).find((h) => h.id === habitId) ?? null;
  const todayLog = habit?.dayLogs[0] ?? null;
  const sessions = todayLog?.exerciseSessions ?? [];
  const totalSets = sessions
    .flatMap((s) => s.exerciseLogs)
    .flatMap((l) => l.exercisePerformances).length;

  return {
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
    habit,
    todayLog,
    sessions,
    totalSets,
  };
}

/**
 * Returns data for a specific session with exercise logs enriched with
 * ExerciseInfo from the catalog. Pass null while sessionId is loading.
 */
export function useActiveSession(sessionId: number | null) {
  const historyQuery = useTodayHistory();
  const exercisesQuery = useExercises();

  const history = historyQuery.data ?? [];
  const exercises = exercisesQuery.data ?? [];

  const found = (() => {
    if (sessionId === null) return null;
    for (const habit of history) {
      for (const dl of habit.dayLogs) {
        const session = dl.exerciseSessions.find((s) => s.id === sessionId);
        if (session) return { habit, dayLog: dl, session };
      }
    }
    return null;
  })();

  const enrichedLogs: EnrichedExerciseLog[] = (found?.session.exerciseLogs ?? []).map((log) => ({
    ...log,
    exercise: exercises.find((e) => e.id === log.exerciseId) ?? null,
  }));

  const totalSets = enrichedLogs.flatMap((l) => l.exercisePerformances).length;

  return {
    isLoading: historyQuery.isLoading || exercisesQuery.isLoading,
    isFetching: historyQuery.isFetching,
    refetch: historyQuery.refetch,
    habit: found?.habit ?? null,
    dayLog: found?.dayLog ?? null,
    session: found?.session ?? null,
    enrichedLogs,
    totalSets,
  };
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

/** Creates a dayLog (upsert) then immediately creates an exercise session. */
export function useStartExerciseSession() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (habitId: number) => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const dayLogResult = await logHabit(
        { habitId, rating: 1, timeStamp: new Date().toISOString() },
        token!,
        tz,
      );
      const session = await createExerciseSession(dayLogResult.id, token!);
      return { dayLogId: dayLogResult.id, session };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trackerHistoryKey });
    },
  });
}

export function useCreateSession() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dayLogId: number) => createExerciseSession(dayLogId, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trackerHistoryKey }),
  });
}

export function useDeleteSession() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: number) => deleteExerciseSession(sessionId, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trackerHistoryKey }),
  });
}

export function useAddExerciseLog() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { exerciseSessionId: number; exerciseId: number }) =>
      addExerciseLog(payload, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trackerHistoryKey }),
  });
}

/** Optimistic: removes the exercise log from cache immediately. */
export function useRemoveExerciseLog() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const cacheKey = [...trackerHistoryKey, todayStr()] as const;

  return useMutation({
    mutationFn: (logId: number) => removeExerciseLog(logId, token!),
    onMutate: async (logId) => {
      await queryClient.cancelQueries({ queryKey: trackerHistoryKey });
      const prev = queryClient.getQueryData<HabitWithHistory[]>(cacheKey);
      queryClient.setQueryData<HabitWithHistory[]>(cacheKey, (old) =>
        patchHistory(old, (history) => {
          for (const h of history)
            for (const dl of h.dayLogs)
              for (const s of dl.exerciseSessions)
                s.exerciseLogs = s.exerciseLogs.filter((l) => l.id !== logId);
        }),
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(cacheKey, context.prev);
    },
  });
}

/**
 * Optimistic: pushes a temp set (id = negative timestamp) and replaces it
 * with the server-confirmed record on success.
 */
export function useCreatePerformance() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const cacheKey = [...trackerHistoryKey, todayStr()] as const;

  return useMutation({
    mutationFn: (payload: CreatePerformanceInput) => createPerformance(payload, token!),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: trackerHistoryKey });
      const prev = queryClient.getQueryData<HabitWithHistory[]>(cacheKey);
      queryClient.setQueryData<HabitWithHistory[]>(cacheKey, (old) =>
        patchHistory(old, (history) => {
          for (const h of history) {
            for (const dl of h.dayLogs) {
              for (const s of dl.exerciseSessions) {
                const log = s.exerciseLogs.find((l) => l.id === payload.exerciseLogId);
                if (log) {
                  log.exercisePerformances.push({
                    id: -Date.now(),
                    exerciseLogId: payload.exerciseLogId,
                    number: payload.number,
                    reps: payload.reps,
                    weight: payload.weight,
                    duration: payload.duration,
                    distance: payload.distance,
                    createdAt: null,
                    rpe: payload.rpe,
                  });
                  return;
                }
              }
            }
          }
        }),
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(cacheKey, context.prev);
    },
    onSuccess: (serverPerf, payload) => {
      queryClient.setQueryData<HabitWithHistory[]>(cacheKey, (old) =>
        patchHistory(old, (history) => {
          for (const h of history) {
            for (const dl of h.dayLogs) {
              for (const s of dl.exerciseSessions) {
                const log = s.exerciseLogs.find((l) => l.id === payload.exerciseLogId);
                if (log) {
                  const ti = log.exercisePerformances.findIndex((p) => p.id < 0);
                  if (ti !== -1) log.exercisePerformances[ti] = serverPerf;
                  return;
                }
              }
            }
          }
        }),
      );
    },
  });
}

/** Optimistic: patches the set in cache immediately. */
export function useUpdatePerformance() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const cacheKey = [...trackerHistoryKey, todayStr()] as const;

  return useMutation({
    mutationFn: ({ id, ...payload }: UpdatePerformanceInput & { id: number }) =>
      updatePerformance(id, payload, token!),
    onMutate: async ({ id, ...payload }) => {
      await queryClient.cancelQueries({ queryKey: trackerHistoryKey });
      const prev = queryClient.getQueryData<HabitWithHistory[]>(cacheKey);
      queryClient.setQueryData<HabitWithHistory[]>(cacheKey, (old) =>
        patchHistory(old, (history) => {
          for (const h of history) {
            for (const dl of h.dayLogs) {
              for (const s of dl.exerciseSessions) {
                for (const log of s.exerciseLogs) {
                  const perf = log.exercisePerformances.find((p) => p.id === id);
                  if (perf) {
                    Object.assign(perf, payload);
                    return;
                  }
                }
              }
            }
          }
        }),
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(cacheKey, context.prev);
    },
  });
}

/** Optimistic: removes the set from cache immediately. */
export function useDeletePerformance() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const cacheKey = [...trackerHistoryKey, todayStr()] as const;

  return useMutation({
    mutationFn: (performanceId: number) => deletePerformance(performanceId, token!),
    onMutate: async (performanceId) => {
      await queryClient.cancelQueries({ queryKey: trackerHistoryKey });
      const prev = queryClient.getQueryData<HabitWithHistory[]>(cacheKey);
      queryClient.setQueryData<HabitWithHistory[]>(cacheKey, (old) =>
        patchHistory(old, (history) => {
          for (const h of history)
            for (const dl of h.dayLogs)
              for (const s of dl.exerciseSessions)
                for (const log of s.exerciseLogs)
                  log.exercisePerformances = log.exercisePerformances.filter(
                    (p) => p.id !== performanceId,
                  );
        }),
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(cacheKey, context.prev);
    },
  });
}
