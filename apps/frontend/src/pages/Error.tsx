import { useRouteError, isRouteErrorResponse, useNavigate } from "react-router-dom";
import { AlertTriangle, Home, RotateCcw, ArrowLeft, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage() {
    const error = useRouteError();
    const navigate = useNavigate();

    // Default Error State
    let title = "Something went wrong";
    let message = "An unexpected error occurred. Our team has been notified.";
    let icon = <AlertTriangle className="w-10 h-10 text-red-500" />;

    // Detect specific error types
    if (isRouteErrorResponse(error)) {
        if (error.status === 404) {
            title = "Page Not Found";
            message = "We couldn't find the page you're looking for. It might have been moved or deleted.";
            icon = <FileQuestion className="w-10 h-10 text-blue-500" />;
        } else {
            title = `${error.status} Error`;
            message = error.statusText || message;
        }
    } else if (error instanceof Error) {
        message = error.message;
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 font-sans">
            <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                <div className="p-8 text-center space-y-6">

                    {/* Icon Container */}
                    <div className="mx-auto w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center border border-slate-100 dark:border-slate-700 shadow-inner">
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-slate-700">
                            {icon}
                        </div>
                    </div>

                    {/* Text Content */}
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                            {title}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                            {message}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <Button
                            variant="outline"
                            onClick={() => navigate(-1)}
                            className="flex-1 gap-2 border-slate-200 dark:border-slate-700"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Go Back
                        </Button>
                        <Button
                            onClick={() => navigate("/")}
                            className="flex-1 gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white"
                        >
                            <Home className="w-4 h-4" />
                            Dashboard
                        </Button>
                    </div>
                </div>

                {/* Footer Strip */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-t border-slate-100 dark:border-slate-700/50 flex justify-center">
                    <button
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                        <RotateCcw className="w-3 h-3" />
                        Reload Application
                    </button>
                </div>
            </div>
        </div>
    );
}