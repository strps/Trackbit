import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Habit, InsertHabit } from '@trackbit/db'

const API_URL = 'http://localhost:3000/api/habits';

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
  console.log(habit)
  const res = await fetch(`${API_URL}/${habit.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(habit),
  });
  if (!res.ok) throw new Error('Failed to update habit');
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
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['habits'] });

      // Snapshot previous value
      const previousHabits = queryClient.getQueryData<Habit[]>(['habits']);

      // Optimistically update to the new value
      // We create a fake temp ID just for the UI render
      queryClient.setQueryData(['habits'], (old: Omit<Habit, 'createdAt'>[] = []) => [
        ...old,
        { ...newHabit, id: Math.random() },
      ]);

      return { previousHabits };
    },
    onError: (_err, _newHabit, context) => {
      // Rollback on error
      if (context?.previousHabits) {
        queryClient.setQueryData(['habits'], context.previousHabits);
      }
    },
    onSettled: () => {
      // Refetch after error or success to ensure sync
      queryClient.invalidateQueries({ queryKey: ['habits'] });
    },
  });

  // Delete with Optimistic Update
  const deleteMutation = useMutation({
    mutationFn: deleteHabit,
    onMutate: async (habitId) => {
      await queryClient.cancelQueries({ queryKey: ['habits'] });
      const previousHabits = queryClient.getQueryData<Habit[]>(['habits']);

      queryClient.setQueryData(['habits'], (old: Habit[] = []) =>
        old.filter(h => h.id !== habitId)
      );

      return { previousHabits };
    },
    onError: (_err, _id, context) => {
      if (context?.previousHabits) {
        queryClient.setQueryData(['habits'], context.previousHabits);
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

      queryClient.setQueryData(['habits'], (old: Habit[] = []) =>
        old.map(h => h.id === updatedHabit.id ? updatedHabit : h)
      );

      return { previousHabits };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousHabits) {
        queryClient.setQueryData(['habits'], context.previousHabits);
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
    updateHabit: updateMutation.mutate
  };
}