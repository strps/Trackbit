import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import HabitConfig from './pages/habits-configuration/HabitsConfig'
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import TrackerHome from './pages/tracker/TrackerHome';
import ExerciseSessionsPage from './pages/sessions/ExerciseSessionsPage';
import AccountSettings from './pages/auth/AccountSettings';
import { ThemeProvider } from './providers/theme-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ExerciseLibrary from './pages/ExerciseLibrary';
import './index.css'
import NotFound from './pages/404.js';
import ErrorPage from './pages/Error.js';
import Landing from './pages/Landing';
import SignInPage from './pages/auth/SignIn';
import SignUpPage from './pages/auth/SignUp';
import ForgotPasswordPage from './pages/auth/ForgotPassword';
import AuthLayout from './layouts/AuthLayout';
import VerifyEmail from './pages/auth/VerifyEmail';
import { Analytics } from './pages/analitytics/Analitytics';
import { Toaster } from './components/ui/sonner';

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout isPublic />,
    children: [
      { index: true, element: <Landing /> }, // 'index' means this renders at "/"
    ],
  },
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      { path: "tracker", element: <TrackerHome /> },
      { path: "sessions", element: <ExerciseSessionsPage /> },
      { path: "account-settings", element: <AccountSettings /> },
      { path: "stats", element: <Analytics /> },
      { path: "config/habits", element: <HabitConfig /> },
      { path: "config/exercises", element: <ExerciseLibrary /> },
    ]
  },
  {
    path: "/",
    element: <AuthLayout />,
    errorElement: <ErrorPage />,
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
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
