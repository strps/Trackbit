import { create } from "zustand";
import { formatDate } from "./utils";

type SimpleValue = number;

interface WorkoutSet {
    exerciseId: number;
    setNumber: number;
    reps: number;
    weight: number;
    weightUnit: string;
}

interface PendingEntry {
    habitId: number;
    dateStr: string;
    type: "simple" | "complex";
    value?: SimpleValue;
    sets?: WorkoutSet[];
}


interface HabitLogState {
    selectedHabitId: Trackbit.Habit["id"] | null;
    selectedDay: string;

    setSelectedHabitId: (id: number | null) => void;
    setSelectedDay: (date: string | null) => void;
}

export const useTrackerStore = create<HabitLogState>((set, get) => ({
    selectedHabitId: null,
    selectedDay: formatDate(new Date()),

    setSelectedHabitId: (id) => set({ selectedHabitId: id }),
    setSelectedDay: (day) => set({ selectedDay: day }),
}));
