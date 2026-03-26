// src/app/providers.tsx
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/providers/theme-provider';
import { Toaster } from '@/shared/components/ui/sonner';           // or wherever your Toaster is
import { queryClient } from '@/shared/lib/react-query';

// Optional: Add your global Zustand providers or other context providers here in the future
// import { UiProvider } from '@/shared/store/ui-provider';

interface AppProvidersProps {
    children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                {children}
                <Toaster />
            </ThemeProvider>
        </QueryClientProvider>
    );
}

