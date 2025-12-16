import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import HabitConfig from './pages/habits-configuration/HabitsConfig'
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import RootLayout from './layouts/RootLayout';
import HabitTracker from './pages/tracker/HabitTracker';
import AuthLayout from './layouts/AuthLayout';
import AuthPage from './pages/auth/AuthPage';
import AccountSettings from './pages/auth/AccountSettings';
import { ThemeProvider } from './providers/theme-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ExerciseLibrary from './pages/ExerciseLibrary';
import './index.css'
import ViveroHomePage from './pages/vivero';
import NotFound from './pages/404.js';
import ErrorPage from './pages/Error.js';
import Landing from './pages/Landing';



const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />, // <--- This is the wrapper we just built
    children: [
      { index: true, element: <Landing /> }, // 'index' means this renders at "/"
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
    element: <NotFound />,
    errorElement: <ErrorPage />
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
