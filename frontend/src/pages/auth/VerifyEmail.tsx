import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { TextField } from "@/components/Field"; // Reuse your Field component
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

type VerificationState = "loading" | "success" | "error" | "resending";

const resendSchema = z.object({
    email: z.string().email("Invalid email address"),
});

type ResendFormData = z.infer<typeof resendSchema>;

export default function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const backendUrl = searchParams.get("backendUrl");

    const [state, setState] = useState<VerificationState>("loading");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [resendSuccess, setResendSuccess] = useState<string | null>(null);
    const [resendError, setResendError] = useState<string | null>(null);

    const form = useForm<ResendFormData>({
        resolver: zodResolver(resendSchema),
        defaultValues: { email: "" },
    });

    useEffect(() => {
        if (!backendUrl) {
            setState("error");
            setErrorMessage("Invalid verification link. Missing backend URL.");
            return;
        }

        const verify = async () => {
            try {
                const response = await fetch(decodeURIComponent(backendUrl), {
                    method: "GET",
                    credentials: "include",
                    redirect: "manual",
                });

                if (response.ok || response.type === "opaqueredirect") {
                    setState("success");
                } else {
                    const url = new URL(response.url);
                    const errorParam = url.searchParams.get("error");
                    setErrorMessage(
                        errorParam === "invalid_token" || errorParam === "expired_token"
                            ? "This verification link has expired or is invalid."
                            : "Verification failed. Please try again or request a new link."
                    );
                    setState("error");
                }
            } catch (err) {
                setErrorMessage("An unexpected error occurred. Please try again.");
                setState("error");
            }
        };

        verify();
    }, [backendUrl]);

    const handleResend = async (data: ResendFormData) => {
        setResendError(null);
        setResendSuccess(null);
        setState("resending");

        try {
            await authClient.sendVerificationEmail({
                email: data.email,
                callbackURL: "/dashboard", // Optional: Adjust to your desired post-verification path
            });
            setResendSuccess("A new verification email has been sent. Please check your inbox.");
            form.reset();
        } catch (err: any) {
            setResendError(err.message || "Failed to send verification email. Please try again.");
        } finally {
            setState("error"); // Return to error view to show resend form again
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Email Verification</CardTitle>
                    <CardDescription>
                        {state === "loading" && "Verifying your email address..."}
                        {state === "success" && "Your email has been successfully verified!"}
                        {(state === "error" || state === "resending") && "Email verification failed"}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center space-y-6">
                    {state === "loading" && <Loader2 className="h-12 w-12 animate-spin text-primary" />}

                    {state === "success" && (
                        <>
                            <CheckCircle2 className="h-16 w-16 text-green-600" />
                            <Alert className="border-green-200 bg-green-50">
                                <AlertDescription className="text-green-800">
                                    You can now access all features of Trackbit.
                                </AlertDescription>
                            </Alert>
                            <Button onClick={() => navigate("/dashboard")} size="lg">
                                Go to Dashboard
                            </Button>
                        </>
                    )}

                    {(state === "error" || state === "resending") && (
                        <>
                            <XCircle className="h-16 w-16 text-destructive" />
                            {errorMessage && (
                                <Alert variant="destructive">
                                    <AlertTitle>Verification Error</AlertTitle>
                                    <AlertDescription>{errorMessage}</AlertDescription>
                                </Alert>
                            )}

                            <form onSubmit={form.handleSubmit(handleResend)} className="w-full space-y-4">
                                <TextField name="email" label="Email" form={form} placeholder="your@email.com" />
                                <Button type="submit" className="w-full" disabled={state === "resending"}>
                                    {state === "resending" ? "Sending..." : "Resend Verification Email"}
                                </Button>
                            </form>

                            {resendSuccess && <Alert variant="default"><AlertDescription className="text-green-600">{resendSuccess}</AlertDescription></Alert>}
                            {resendError && <Alert variant="destructive"><AlertDescription>{resendError}</AlertDescription></Alert>}

                            <Button onClick={() => navigate("/signin")} variant="outline">
                                Back to Sign In
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}