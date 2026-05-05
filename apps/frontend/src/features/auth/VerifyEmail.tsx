import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { authClient } from "@/shared/lib/auth-client";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { TextField } from "@/shared/components/Fields/TextField";
import { useTranslation } from "react-i18next";

type VerificationState = "loading" | "success" | "error" | "resending";

const resendSchema = z.object({
    email: z.string().email(),
});

type ResendFormData = z.infer<typeof resendSchema>;

export default function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { t } = useTranslation('auth');
    const backendUrl = searchParams.get("backendUrl");

    const [state, setState] = useState<VerificationState>("loading");
    const [errorKey, setErrorKey] = useState<string | null>(null);
    const [resendSuccess, setResendSuccess] = useState<string | null>(null);
    const [resendError, setResendError] = useState<string | null>(null);

    const form = useForm<ResendFormData>({
        resolver: zodResolver(resendSchema),
        defaultValues: { email: "" },
    });

    useEffect(() => {
        if (!backendUrl) {
            setState("error");
            setErrorKey("verify.error.missing_url");
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
                    setErrorKey(
                        errorParam === "invalid_token" || errorParam === "expired_token"
                            ? "verify.error.invalid_token"
                            : "verify.error.verification_failed"
                    );
                    setState("error");
                }
            } catch (err) {
                setErrorKey("verify.error.unexpected");
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
                callbackURL: "/dashboard",
            });
            setResendSuccess(t('verify.resend_success'));
            form.reset();
        } catch (err: any) {
            setResendError(err.message || t('verify.resend_error'));
        } finally {
            setState("error");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">{t('verify.title')}</CardTitle>
                    <CardDescription>
                        {state === "loading" && t('verify.loading')}
                        {state === "success" && t('verify.success_description')}
                        {(state === "error" || state === "resending") && t('verify.error_description')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center space-y-6">
                    {state === "loading" && <Loader2 className="h-12 w-12 animate-spin text-primary" />}

                    {state === "success" && (
                        <>
                            <CheckCircle2 className="h-16 w-16 text-green-600" />
                            <Alert className="border-green-200 bg-green-50">
                                <AlertDescription className="text-green-800">
                                    {t('verify.feature_access')}
                                </AlertDescription>
                            </Alert>
                            <Button onClick={() => navigate("/dashboard")} size="lg">
                                {t('verify.go_dashboard')}
                            </Button>
                        </>
                    )}

                    {(state === "error" || state === "resending") && (
                        <>
                            <XCircle className="h-16 w-16 text-destructive" />
                            {errorKey && (
                                <Alert variant="destructive">
                                    <AlertTitle>{t('verify.error_title')}</AlertTitle>
                                    <AlertDescription>{t(errorKey)}</AlertDescription>
                                </Alert>
                            )}

                            <form onSubmit={form.handleSubmit(handleResend)} className="w-full space-y-4">
                                <TextField name="email" label={t('verify.email_label')} form={form} placeholder="your@email.com" />
                                <Button type="submit" className="w-full" disabled={state === "resending"}>
                                    {state === "resending" ? t('verify.resend_submitting') : t('verify.resend_submit')}
                                </Button>
                            </form>

                            {resendSuccess && <Alert variant="default"><AlertDescription className="text-green-600">{resendSuccess}</AlertDescription></Alert>}
                            {resendError && <Alert variant="destructive"><AlertDescription>{resendError}</AlertDescription></Alert>}

                            <Button onClick={() => navigate("/signin")} variant="outline">
                                {t('verify.back_signin')}
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
