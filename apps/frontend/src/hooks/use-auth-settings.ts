import { useQuery } from '@tanstack/react-query';

const API_URL = `${import.meta.env.VITE_API_URL}/config/auth-settings`;

export interface AuthSettings {
    googleLoginEnabled: boolean;
    githubLoginEnabled: boolean;
    passwordLoginEnabled: boolean;
}

const fetchAuthSettings = async (): Promise<AuthSettings> => {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error('Failed to fetch auth settings');
    return res.json();
};

export function useAuthSettings() {
    return useQuery({
        queryKey: ['auth-settings'],
        queryFn: fetchAuthSettings,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
        placeholderData: {
            googleLoginEnabled: true,
            githubLoginEnabled: true,
            passwordLoginEnabled: true,
        },
    });
}
