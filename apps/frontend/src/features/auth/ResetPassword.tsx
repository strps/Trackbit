import React from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authClient } from '@/shared/lib/auth-client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { PasswordField } from '@/shared/components/Fields/PasswordField';
import { useTranslation } from 'react-i18next';

const resetSchema = z.object({
    password: z.string().min(8),
    passwordConfirm: z.string(),
});

type ResetFormData = z.infer<typeof resetSchema>;

// The emailed reset link lands here with `?token=` (the server builds it, for
// links requested from the web and from the Android app alike).
export default function ResetPasswordPage() {
    const navigate = useNavigate();
    const { t } = useTranslation('auth');
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [isLoading, setIsLoading] = React.useState(false);
    const [done, setDone] = React.useState(false);
    // A missing or spent token can only be fixed by requesting a new link.
    const [invalidLink, setInvalidLink] = React.useState(!token);
    const [error, setError] = React.useState<string | null>(null);

    const form = useForm<ResetFormData>({
        resolver: zodResolver(resetSchema),
        defaultValues: { password: '', passwordConfirm: '' },
    });

    const onSubmit = async (data: ResetFormData) => {
        if (!token) return;
        if (data.password !== data.passwordConfirm) {
            form.setError('passwordConfirm', { message: t('sign_up.passwords_mismatch') });
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            await authClient.resetPassword({ newPassword: data.password, token }, {
                onSuccess: () => setDone(true),
                onError: (ctx) => {
                    if (ctx.error.code === 'INVALID_TOKEN') setInvalidLink(true);
                    else setError(ctx.error.message || t('sign_up.error_unexpected'));
                },
            });
        } catch (err: any) {
            setError(err.message || t('sign_up.error_unexpected'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-background">
            <div className="flex-1 flex items-center justify-center p-6">
                <Card className="w-full max-w-md">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl font-bold">{t('reset.title')}</CardTitle>
                        <CardDescription>{t('reset.description')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {done ? (
                            <Alert variant="default">
                                <AlertDescription className="text-green-600">{t('reset.success')}</AlertDescription>
                            </Alert>
                        ) : (
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                {invalidLink && (
                                    <Alert variant="destructive">
                                        <AlertDescription>
                                            {t('reset.invalid_link')}{' '}
                                            <Button variant="link" className="h-auto p-0" onClick={() => navigate('/forgot')}>
                                                {t('reset.request_new')}
                                            </Button>
                                        </AlertDescription>
                                    </Alert>
                                )}
                                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                                <PasswordField name="password" label={t('reset.password')} form={form} placeholder="••••••••" />
                                <PasswordField name="passwordConfirm" label={t('sign_up.password_confirm')} form={form} placeholder="••••••••" />
                                <Button className="w-full" type="submit" disabled={isLoading || invalidLink}>
                                    {isLoading ? t('reset.submitting') : t('reset.submit')}
                                </Button>
                            </form>
                        )}
                    </CardContent>
                    <CardFooter>
                        <Button variant="link" onClick={() => navigate('/signin')} className="w-full">
                            {t('forgot.back')}
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            <div className="hidden lg:flex w-1/2 bg-muted relative overflow-hidden items-center justify-center" />
        </div>
    );
}
