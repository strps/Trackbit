import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import { ThemeProvider } from './providers/theme-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'

import Landing from './pages/Landing';


const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout isPublic />,
    children: [
      { index: true, element: <Landing /> }, // 'index' means this renders at "/"
      { path: "vivero", element: <ViveroHomePage /> },
    ],
  },

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
