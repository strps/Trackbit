import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import HabitConfig from './pages/habits-configuration/HabitsConfig.tsx'
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import RootLayout from './layouts/RootLayout.tsx';
import HabitTracker from './pages/tracker/HabitTracker.tsx';
import AuthLayout from './layouts/AuthLayout.tsx';
import AuthPage from './pages/auth/AuthPage.tsx';
import AccountSettings from './pages/auth/AccountSettings.tsx';
import { ThemeProvider } from './providers/theme-provider.tsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ExerciseLibrary from './pages/ExerciseLibrary.tsx';
import './index.css'
import ViveroHomePage from './pages/vivero.tsx';



const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />, // <--- This is the wrapper we just built
    children: [
      { index: true, element: <HabitTracker /> }, // 'index' means this renders at "/"
      { path: "habits", element: <HabitConfig /> },
      { path: "dashboard", element: <HabitTracker /> },
      { path: "analytics", element: <div className="p-4">Analytics Page</div> },
      { path: "account-settings", element: <AccountSettings /> },
      { path: "exercises", element: <ExerciseLibrary /> },
      { path: "vivero", element: <ViveroHomePage /> },

    ],
  },
  {
    path: "/auth",
    element: <AuthLayout />,
    children: [
      { index: true, element: <AuthPage /> },
      { path: "login", element: <AuthPage /> },
    ]
  },
  {
    path: "*",
    element: <div className="p-4">404 - Page Not Found</div>,
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
