import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import HabitConfiguration from './pages/HabitsConfiguration.tsx'
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import RootLayout from './layouts/RootLayout.tsx';
import HabitTracker from './pages/HabitsTracker.tsx';
import AuthLayout from './layouts/AuthLayout.tsx';
import AuthPage from './pages/auth/Login.tsx';
import AccountSettings from './pages/auth/AccountSettings.tsx';
import { ThemeProvider } from './providers/theme-provider.tsx';


const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />, // <--- This is the wrapper we just built
    children: [
      { index: true, element: <HabitTracker /> }, // 'index' means this renders at "/"
      { path: "habits", element: <HabitConfiguration /> },
      { path: "dashboard", element: <HabitTracker /> },
      { path: "analytics", element: <div className="p-4">Analytics Page</div> },
      { path: "account-settings", element: <AccountSettings /> },
    ],
  },
  {
    path: "/auth",
    element: <AuthLayout />,
    children: [
      { index: true, element: <div className="p-4">Auth Home - Login / Register</div> },
      { path: "login", element: <AuthPage /> },
    ]
  },
  {
    path: "*",
    element: <div className="p-4">404 - Page Not Found</div>,
  }
]);



createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>,
)
