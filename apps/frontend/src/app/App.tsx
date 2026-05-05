import { Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { AppProviders } from './providers';
import { useLocaleSync } from '@/i18n/useLocaleSync';

function LocaleSync() {
  useLocaleSync();
  return null;
}

export default function App() {
  return (
    <AppProviders>
      <LocaleSync />
      <Suspense fallback={null}>
        <RouterProvider router={router} />
      </Suspense>
    </AppProviders>
  )
}
