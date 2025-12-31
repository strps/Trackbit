import { useRouteError, isRouteErrorResponse, useNavigate } from "react-router-dom";
import { AlertTriangle, Home, RotateCcw, ArrowLeft, FileQuestion, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

export default function ErrorPage() {
    const error = useRouteError();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);

    // Default Error State
    let title = "Something went wrong";
    let message = "An unexpected error occurred. Our team has been notified.";
    let icon = <AlertTriangle className="h-12 w-12 text-destructive" />;
    let status: number | null = null;
    let errorDetails: string | null = null;

    // Detect specific error types
    if (isRouteErrorResponse(error)) {
        status = error.status;
        if (error.status === 404) {
            title = "Page Not Found";
            message = "We couldn't find the page you're looking for. It might have been moved or deleted.";
            icon = <FileQuestion className="h-12 w-12 text-primary" />;
        } else {
            title = `${error.status} ${error.statusText || "Error"}`;
            message = error.data?.message || error.statusText || message;
        }
    } else if (error instanceof Error) {
        title = "Unexpected Error";
        message = error.message || message;
        errorDetails = error.stack || null;
        icon = <Bug className="h-12 w-12 text-destructive" />;
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <Card className="w-full max-w-lg">
                <CardHeader className="text-center space-y-6">
                    <div className="mx-auto w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                        <div>{icon}</div>
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="text-3xl">{title}</CardTitle>
                        {status && <p className="text-5xl font-bold text-muted-foreground">{status}</p>}
                        <CardDescription className="text-base max-w-md mx-auto">
                            {message}
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    <Alert variant={status === 404 ? "default" : "destructive"}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Error Summary</AlertTitle>
                        <AlertDescription>
                            {isRouteErrorResponse(error)
                                ? "This is a route-related error."
                                : "This is a client-side JavaScript error."}
                        </AlertDescription>
                    </Alert>

                    {(error instanceof Error || isRouteErrorResponse(error)) && (
                        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                            <CollapsibleTrigger asChild>
                                <Button variant="outline" className="w-full justify-between">
                                    <span className="flex items-center gap-2">
                                        <Bug className="h-4 w-4" />
                                        Show technical details
                                    </span>
                                    <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                                </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-4">
                                <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto">
                                    {errorDetails || (error as any).data || (error as Error).message || String(error)}
                                </pre>
                            </CollapsibleContent>
                        </Collapsible>
                    )}
                </CardContent>

                <CardFooter className="flex flex-col gap-3 border-t bg-muted/50 pt-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                        <Button
                            variant="outline"
                            onClick={() => navigate(-1)}
                            className="gap-2"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Go Back
                        </Button>
                        <Button
                            onClick={() => navigate("/")}
                            className="gap-2"
                        >
                            <Home className="h-4 w-4" />
                            Dashboard
                        </Button>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Reload Application
                    </button>
                </CardFooter>
            </Card>
        </div>
    );
}