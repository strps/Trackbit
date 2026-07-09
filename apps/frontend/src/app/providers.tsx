// src/app/providers.tsx
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/providers/theme-provider';
import { UnitSystemProvider } from '@/providers/unit-system-provider';
import { ExerciseCardStyleProvider } from '@/providers/exercise-card-style-provider';
import { Toaster } from '@/shared/components/ui/sonner';           // or wherever your Toaster is
import { queryClient } from '@/shared/lib/react-query';

interface AppProvidersProps {
    children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <UnitSystemProvider>
                    <ExerciseCardStyleProvider>
                        {children}
                        <Toaster />
                    </ExerciseCardStyleProvider>
                </UnitSystemProvider>
            </ThemeProvider>
        </QueryClientProvider>
    );
}

