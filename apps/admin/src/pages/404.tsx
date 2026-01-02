import { useNavigate } from "react-router-dom";
import { Activity, ArrowLeft, Home, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 font-sans">
            <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in-95 duration-300">

                {/* Visual Element: A "Ghost" Heatmap */}
                <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
                    {/* Background decoration */}
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl opacity-50" />

                    <div className="relative bg-card p-4 rounded-2xl shadow-lg border border-border flex flex-col gap-1.5 items-center">
                        {/* A mini 404 grid pattern */}
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-sm bg-muted" />
                            <div className="w-3 h-3 rounded-sm bg-primary" />
                            <div className="w-3 h-3 rounded-sm bg-muted" />
                        </div>
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-sm bg-primary" />
                            <div className="w-3 h-3 rounded-sm bg-muted/50 border-2 border-dashed border-muted-foreground/25" /> {/* The Missing Piece */}
                            <div className="w-3 h-3 rounded-sm bg-primary" />
                        </div>
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-sm bg-muted" />
                            <div className="w-3 h-3 rounded-sm bg-primary" />
                            <div className="w-3 h-3 rounded-sm bg-muted" />
                        </div>

                        {/* Floating Icon */}
                        <div className="absolute -right-2 -bottom-2 bg-destructive/10 text-destructive p-1.5 rounded-lg border border-background shadow-sm">
                            <FileQuestion className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* Text Content */}
                <div className="space-y-2">
                    <h1 className="text-4xl font-black text-foreground tracking-tight">
                        Lost the Track? 404 Not Found! 🏃‍♂️
                    </h1>
                    <p className="text-muted-foreground text-lg">
                        This page has veered off course and couldn't be located. No worries—your habits and progress are still on track elsewhere.
                        Head back to the dashboard and keep logging those consistent wins!
                    </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                        variant="outline"
                        onClick={() => navigate(-1)}
                        className="gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Go Back
                    </Button>

                    <Button
                        onClick={() => navigate("/")}
                        className="gap-2"
                    >
                        <Home className="w-4 h-4" />
                        Back to Dashboard
                    </Button>
                </div>

                {/* Footer decoration */}
                <div className="pt-8">
                    <div className="flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-widest opacity-50">
                        <Activity className="w-3 h-3" />
                        Trackbit System
                    </div>
                </div>

            </div>
        </div>
    );
}