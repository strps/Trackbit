import { Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { AppProviders } from './providers';
import { useLocaleSync } from '@/i18n/useLocaleSync';
import { useUnitSystemSync } from '@/i18n/useUnitSystemSync';

function AppSync() {
  useLocaleSync();
  useUnitSystemSync();
  return null;
}

export default function App() {
  return (
    <AppProviders>
      <AppSync />
      <Suspense fallback={null}>
        <RouterProvider router={router} />
      </Suspense>
    </AppProviders>
  )
}
