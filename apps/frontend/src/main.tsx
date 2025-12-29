import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import HabitConfig from './pages/habits-configuration/HabitsConfig'
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import HabitTracker from './pages/tracker/HabitTracker';
import AccountSettings from './pages/auth/AccountSettings';
import { ThemeProvider } from './providers/theme-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ExerciseLibrary from './pages/ExerciseLibrary';
import './index.css'
import ViveroHomePage from './pages/vivero';
import NotFound from './pages/404.js';
import ErrorPage from './pages/Error.js';
import Landing from './pages/Landing';
import SignInPage from './pages/auth/SignIn';
import SignUpPage from './pages/auth/SignUp';
import ForgotPasswordPage from './pages/auth/ForgotPassword';
import AuthLayout from './layouts/AuthLayout';
import VerifyEmail from './pages/auth/VerifyEmail';

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout isPublic />,
    children: [
      { index: true, element: <Landing /> }, // 'index' means this renders at "/"
      { path: "vivero", element: <ViveroHomePage /> },
    ],
  },
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { path: "habits", element: <HabitConfig /> },
      { path: "dashboard", element: <HabitTracker /> },
      { path: "account-settings", element: <AccountSettings /> },
      { path: "exercises", element: <ExerciseLibrary /> },
    ]
  },
  {
    path: "/",
    element: <AuthLayout />,
    children: [
      { path: "signin", element: <SignInPage /> },
      { path: "signup", element: <SignUpPage /> },
      { path: "forgot", element: <ForgotPasswordPage /> },
      { path: "verify-email", element: <VerifyEmail /> },
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
