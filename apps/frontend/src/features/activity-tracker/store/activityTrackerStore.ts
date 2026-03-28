import { create } from 'zustand';

interface ActivityTrackerStore {
    selectedLogId: number | null;
    selectedSessionIndex: number;
    // Actions
    selectLogId: (logId: number | null) => void;
    selectSessionIndex: (index: number) => void;
}

export const useActivityTrackerStore = create<ActivityTrackerStore>((set) => ({
    selectedLogId: null,
    selectedSessionIndex: 0,
    selectLogId: (logId) => set({ selectedLogId: logId }),
    selectSessionIndex: (index) => set({ selectedSessionIndex: index }),
}));