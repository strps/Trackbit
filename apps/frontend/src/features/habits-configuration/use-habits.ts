import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Habit } from "@trackbit/types"
import { GRADIENT_PRESETS } from '@/features/habits-configuration/ColorThemeField';
import type { HabitWithLogs } from '@/features/tracker/use-tracker';

const resolveColorStops = (habit: Habit | Omit<Habit, 'id' | 'createdAt'>) =>
  habit.colorTheme === 'custom'
    ? habit.colorStops
    : GRADIENT_PRESETS[habit.colorTheme]?.stops ?? [];

const API_URL = `${import.meta.env.VITE_API_URL}/habits`;

// --- Fetcher Functions ---

const fetchHabits = async (): Promise<Habit[]> => {
  const res = await fetch(API_URL, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include' // Important for Better-Auth cookies
  });
  if (!res.ok) throw new Error('Failed to fetch habits');
  return res.json();
};

const createHabit = async (newHabit: Omit<Habit, 'id' | 'createdAt'>) => {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(newHabit),
  });
  if (!res.ok) throw new Error('Failed to create habit');
  return res.json();
};

const deleteHabit = async (id: number) => {
  const res = await fetch(`${API_URL}/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to delete habit');
  return res.json();
};

const updateHabit = async (habit: Habit) => {
  const res = await fetch(`${API_URL}/${habit.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(habit),
  });
  if (!res.ok) throw new Error('Failed to update habit');
  return res.json();
};

interface ReorderItem {
  id: number;
  order: number;
  isAntiHabit: boolean;
}

const reorderHabits = async (items: ReorderItem[]) => {
  const res = await fetch(`${API_URL}/reorder`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error('Failed to reorder habits');
  return res.json();
};

// --- Custom Hook ---

export function useHabits() {
  const queryClient = useQueryClient();

  // 1. Query (Read)
  const habitsQuery = useQuery({
    queryKey: ['habits'],
    queryFn: fetchHabits,
  });

  // 2. Mutations (Write)

  // Create with Optimistic Update
  const createMutation = useMutation({
    mutationFn: createHabit,
    onMutate: async (newHabit) => {
      await queryClient.cancelQueries({ queryKey: ['habits'] });
      const previousHabits = queryClient.getQueryData<Habit[]>(['habits']);

      queryClient.setQueryData(['habits'], (old: Omit<Habit, 'createdAt'>[] = []) => [
        ...old,
        { ...newHabit, id: Math.random() },
      ]);

      return { previousHabits };
    },
    onSuccess: (serverHabit: Habit) => {
      // Insert the new habit into the tracker cache
      queryClient.setQueryData(['habit-logs'], (old: Record<number, HabitWithLogs> | undefined) => {
        if (!old) return old;
        const updated = structuredClone(old);
        updated[serverHabit.id] = {
          ...serverHabit,
          colorStops: resolveColorStops(serverHabit),
          dayLogs: {},
        };
        return updated;
      });
    },
    onError: (_err, _newHabit, context) => {
      if (context?.previousHabits) {
        queryClient.setQueryData(['habits'], context.previousHabits);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
    },
  });

  // Delete with Optimistic Update
  const deleteMutation = useMutation({
    mutationFn: deleteHabit,
    onMutate: async (habitId) => {
      await queryClient.cancelQueries({ queryKey: ['habits'] });
      const previousHabits = queryClient.getQueryData<Habit[]>(['habits']);
      const previousLogs = queryClient.getQueryData<Record<number, HabitWithLogs>>(['habit-logs']);

      queryClient.setQueryData(['habits'], (old: Habit[] = []) =>
        old.filter(h => h.id !== habitId)
      );

      // Remove from tracker cache
      queryClient.setQueryData(['habit-logs'], (old: Record<number, HabitWithLogs> | undefined) => {
        if (!old) return old;
        const updated = structuredClone(old);
        delete updated[habitId];
        return updated;
      });

      return { previousHabits, previousLogs };
    },
    onError: (_err, _id, context) => {
      if (context?.previousHabits) {
        queryClient.setQueryData(['habits'], context.previousHabits);
      }
      if (context?.previousLogs) {
        queryClient.setQueryData(['habit-logs'], context.previousLogs);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
    },
  });

  // Update with Optimistic Update
  const updateMutation = useMutation({
    mutationFn: updateHabit,
    onMutate: async (updatedHabit) => {
      await queryClient.cancelQueries({ queryKey: ['habits'] });
      const previousHabits = queryClient.getQueryData<Habit[]>(['habits']);
      const previousLogs = queryClient.getQueryData<Record<number, HabitWithLogs>>(['habit-logs']);

      queryClient.setQueryData(['habits'], (old: Habit[] = []) =>
        old.map(h => h.id === updatedHabit.id ? updatedHabit : h)
      );

      // Update habit properties in tracker cache, preserving dayLogs
      queryClient.setQueryData(['habit-logs'], (old: Record<number, HabitWithLogs> | undefined) => {
        if (!old || !old[updatedHabit.id]) return old;
        const updated = structuredClone(old);
        updated[updatedHabit.id] = {
          ...updated[updatedHabit.id],
          ...updatedHabit,
          colorStops: resolveColorStops(updatedHabit),
          dayLogs: updated[updatedHabit.id].dayLogs,
        };
        return updated;
      });

      return { previousHabits, previousLogs };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousHabits) {
        queryClient.setQueryData(['habits'], context.previousHabits);
      }
      if (context?.previousLogs) {
        queryClient.setQueryData(['habit-logs'], context.previousLogs);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
    },
  });

  // Reorder with Optimistic Update
  const reorderMutation = useMutation({
    mutationFn: reorderHabits,
    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: ['habits'] });
      const previousHabits = queryClient.getQueryData<Habit[]>(['habits']);
      const previousLogs = queryClient.getQueryData<Record<number, HabitWithLogs>>(['habit-logs']);

      // Apply optimistic reorder
      queryClient.setQueryData(['habits'], (old: Habit[] = []) => {
        const itemMap = new Map(items.map(i => [i.id, i]));
        return old.map(h => {
          const update = itemMap.get(h.id);
          return update ? { ...h, order: update.order, isAntiHabit: update.isAntiHabit } : h;
        });
      });

      // Apply reorder to tracker cache
      queryClient.setQueryData(['habit-logs'], (old: Record<number, HabitWithLogs> | undefined) => {
        if (!old) return old;
        const updated = structuredClone(old);
        const itemMap = new Map(items.map(i => [i.id, i]));
        for (const [id, habit] of Object.entries(updated)) {
          const update = itemMap.get(Number(id));
          if (update) {
            habit.order = update.order;
            habit.isAntiHabit = update.isAntiHabit;
          }
        }
        return updated;
      });

      return { previousHabits, previousLogs };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousHabits) {
        queryClient.setQueryData(['habits'], context.previousHabits);
      }
      if (context?.previousLogs) {
        queryClient.setQueryData(['habit-logs'], context.previousLogs);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
    },
  });

  return {
    habits: habitsQuery.data ?? [],
    isLoading: habitsQuery.isLoading,
    isError: habitsQuery.isError,
    createHabit: createMutation.mutate,
    deleteHabit: deleteMutation.mutate,
    updateHabit: updateMutation.mutate,
    reorderHabits: reorderMutation.mutate,
  };
}