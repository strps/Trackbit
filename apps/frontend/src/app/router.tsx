import AppLayout from "@/layouts/AppLayout";
import AuthLayout from "@/layouts/AuthLayout";
import NotFound from "@/features/errors/404";
import { Analytics } from "@/features/analytics/Analytics";
import AccountSettings from "@/features/auth/AccountSettings";
import ForgotPasswordPage from "@/features/auth/ForgotPassword";
import SignInPage from "@/features/auth/SignIn";
import SignUpPage from "@/features/auth/SignUp";
import VerifyEmail from "@/features/auth/VerifyEmail";
import ErrorPage from "@/features/errors/Error";
import ExerciseLibrary from "@/features/exercise-library/ExerciseLibrary";
import ExerciseLists from "@/features/exercise-lists/ExerciseLists";
import HabitConfig from "@/features/habits-configuration/HabitsConfig";
import Landing from "@/features/public/Landing";
import ActivityTracker from "@/features/activity-tracker/ActivityTracker";
import TrackerHome from "@/features/tracker/TrackerHome";
import { QueryClient } from "@tanstack/react-query";
import { createBrowserRouter } from "react-router-dom";

export const router = createBrowserRouter([
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
            { path: "sessions", element: <ActivityTracker /> },
            { path: "account-settings", element: <AccountSettings /> },
            { path: "stats", element: <Analytics /> },
            { path: "config/habits", element: <HabitConfig /> },
            { path: "config/exercises", element: <ExerciseLibrary /> },
            { path: "config/lists", element: <ExerciseLists /> },
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

