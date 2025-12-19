import { useNavigate } from "react-router-dom";
import { Activity, ArrowLeft, Home, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 font-sans">
            <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in-95 duration-300">

                {/* Visual Element: A "Ghost" Heatmap */}
                <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
                    {/* Background decoration */}
                    <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/20 rounded-full blur-xl opacity-50" />

                    <div className="relative bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 flex flex-col gap-1.5 items-center">
                        {/* A mini 404 grid pattern */}
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-sm bg-slate-200 dark:bg-slate-700" />
                            <div className="w-3 h-3 rounded-sm bg-blue-500" />
                            <div className="w-3 h-3 rounded-sm bg-slate-200 dark:bg-slate-700" />
                        </div>
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-sm bg-blue-500" />
                            <div className="w-3 h-3 rounded-sm bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600" /> {/* The Missing Piece */}
                            <div className="w-3 h-3 rounded-sm bg-blue-500" />
                        </div>
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-sm bg-slate-200 dark:bg-slate-700" />
                            <div className="w-3 h-3 rounded-sm bg-blue-500" />
                            <div className="w-3 h-3 rounded-sm bg-slate-200 dark:bg-slate-700" />
                        </div>

                        {/* Floating Icon */}
                        <div className="absolute -right-2 -bottom-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-1.5 rounded-lg border border-white dark:border-slate-800 shadow-sm">
                            <FileQuestion className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* Text Content */}
                <div className="space-y-2">
                    <h1 className="text-4xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
                        Off the Grid
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-lg">
                        We couldn't find the page you're looking for. It seems this data point hasn't been logged yet.
                    </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                        variant="outline"
                        onClick={() => navigate(-1)}
                        className="gap-2 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Go Back
                    </Button>

                    <Button
                        onClick={() => navigate("/")}
                        className="gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                        <Home className="w-4 h-4" />
                        Back to Dashboard
                    </Button>
                </div>

                {/* Footer decoration */}
                <div className="pt-8">
                    <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-widest opacity-50">
                        <Activity className="w-3 h-3" />
                        Trackbit System
                    </div>
                </div>

            </div>
        </div>
    );
}