import { create } from "zustand";

export interface AuthSettingsDraft {
    googleLoginEnabled: boolean;
    githubLoginEnabled: boolean;
    passwordLoginEnabled: boolean;
}

interface SettingsStore {
    draft: AuthSettingsDraft | null;
    server: AuthSettingsDraft | null;
    isDirty: boolean;

    /** Called once server data loads or after a successful save */
    syncFromServer: (data: AuthSettingsDraft) => void;

    /** Toggle a single field in the local draft */
    toggle: (field: keyof AuthSettingsDraft) => void;

    /** Returns only the fields that changed, or null if nothing changed */
    getChanges: () => Partial<AuthSettingsDraft> | null;

    /** Reset draft back to server state (discard changes) */
    discard: () => void;
}

export const useSettingsStore = create<SettingsStore>()((set, get) => ({
    draft: null,
    server: null,
    isDirty: false,

    syncFromServer: (data: AuthSettingsDraft) => {
        set({
            server: { ...data },
            draft: { ...data },
            isDirty: false,
        });
    },

    toggle: (field: keyof AuthSettingsDraft) => {
        const { draft, server } = get();
        if (!draft || !server) return;

        const updated = { ...draft, [field]: !draft[field] };
        const dirty =
            updated.googleLoginEnabled !== server.googleLoginEnabled ||
            updated.githubLoginEnabled !== server.githubLoginEnabled ||
            updated.passwordLoginEnabled !== server.passwordLoginEnabled;

        set({ draft: updated, isDirty: dirty });
    },

    getChanges: () => {
        const { draft, server } = get();
        if (!draft || !server) return null;

        const changes: Partial<AuthSettingsDraft> = {};
        if (draft.googleLoginEnabled !== server.googleLoginEnabled)
            changes.googleLoginEnabled = draft.googleLoginEnabled;
        if (draft.githubLoginEnabled !== server.githubLoginEnabled)
            changes.githubLoginEnabled = draft.githubLoginEnabled;
        if (draft.passwordLoginEnabled !== server.passwordLoginEnabled)
            changes.passwordLoginEnabled = draft.passwordLoginEnabled;

        return Object.keys(changes).length > 0 ? changes : null;
    },

    discard: () => {
        const { server } = get();
        if (!server) return;
        set({ draft: { ...server }, isDirty: false });
    },
}));
