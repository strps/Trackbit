import { Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { AppProviders } from './providers';

export default function App() {
  return (
    <AppProviders>
      <Suspense fallback={null}>
        <RouterProvider router={router} />
      </Suspense>
    </AppProviders>
  )
}
