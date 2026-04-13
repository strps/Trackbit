import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider } from '@trackbit/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { Home } from './features/auth/Home';
import { InvitationPage } from './features/invitations/Invitations';
import NotFound from './features/errors/404';
import AdminLayout from './layouts/AdminLayout';
import UsersPage from './features/users/Users';
import ExercisesPage from './features/exercises/Exercises';
import AuthLayout from './layouts/AuthLayout';
import Dashboard from './features/dashboard/Dashboard';
import SettingsPage from './features/settings/Settings';


const router = createBrowserRouter([
  {
    path: "/",
    element: <AuthLayout />,
    children: [
      { index: true, element: <Home /> }, // 'index' means this renders at "/"
    ],
  },
  {
    path: "/",
    element: <AdminLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "/dashboard", element: <Dashboard /> },
      { path: "/invite", element: <InvitationPage /> },
      { path: '/users', element: <UsersPage /> },
      { path: '/exercises', element: <ExercisesPage /> },
      { path: '/settings', element: <SettingsPage /> }

    ]
  },
  {
    path: "*",
    element: <NotFound />,
  }

]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 1 minute
      staleTime: 1000 * 60,
      // Do not retry immediately on 404s, etc.
      retry: 1,
    },
  },
})


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
