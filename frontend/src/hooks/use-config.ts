import { useQuery } from '@tanstack/react-query';

const API_URL = 'http://localhost:3000/api/config/ui';

export interface NavItem {
    title: string;
    href: string;
    icon: string; // String name of Lucide icon
    active?: boolean;
}

export interface UIConfig {
    appName: string;
    isBetaUser: boolean;
    primaryNav: NavItem[];
    dashboardWidgets: string[];
}

const fetchConfig = async (): Promise<UIConfig> => {
    // Credentials included to send the session cookie
    const res = await fetch(API_URL, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch UI configuration');
    return res.json();
};

export function useUIConfig() {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['ui-config'],
        queryFn: fetchConfig,
        // Config rarely changes, so cache it longer
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false,
    });

    // Provide a safe default structure while loading or if fetching fails
    const defaultConfig: UIConfig = {
        appName: "HabitTrack",
        isBetaUser: false,
        primaryNav: [
            { title: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
            { title: "Settings", href: "/account-settings", icon: "Settings" },
        ],
        dashboardWidgets: [],
    };

    return {
        config: data || defaultConfig,
        isLoading,
        isError,
    };
}