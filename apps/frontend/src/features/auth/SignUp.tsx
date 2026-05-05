import React from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authClient } from '@/shared/lib/auth-client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { UseFormReturn } from "react-hook-form";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { GoogleIcon, GithubIcon } from './Icons';
import { TextField } from '@/shared/components/Fields/TextField';
import { PasswordField } from '@/shared/components/Fields/PasswordField';
import { useAuthSettings } from '@/hooks/use-auth-settings';
import { useTranslation } from 'react-i18next';

const SUPPORTED_LOCALES = ['en', 'es']

function detectLocale(): string {
    const lang = navigator.language.split('-')[0].toLowerCase()
    return SUPPORTED_LOCALES.includes(lang) ? lang : 'en'
}

const signUpSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    passwordConfirm: z.string(),
    inviteCode: z.string().optional(),
});

type SignUpFormData = z.infer<typeof signUpSchema>;

export default function SignUpPage() {
    const navigate = useNavigate();
    const { t } = useTranslation('auth');
    const [searchParams] = useSearchParams();
    const urlInviteCode = searchParams.get('code') || '';
    const showInviteField = searchParams.get('invite') === 'true';

    const [isLoading, setIsLoading] = React.useState(false);
    const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const { data: authSettings } = useAuthSettings();

    const form: UseFormReturn<SignUpFormData> = useForm<SignUpFormData>({
        resolver: zodResolver(signUpSchema),
        defaultValues: {
            name: '',
            email: '',
            password: '',
            passwordConfirm: '',
            inviteCode: urlInviteCode,
        },
    });

    const onSubmit = async (data: SignUpFormData) => {
        if (data.password !== data.passwordConfirm) {
            form.setError('passwordConfirm', { message: t('sign_up.passwords_mismatch') });
            return;
        }

        if (showInviteField && !data.inviteCode?.trim()) {
            setError(t('sign_up.invite_required'));
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            await authClient.signUp.email({
                name: data.name,
                email: data.email,
                password: data.password,
                inviteCode: data.inviteCode,
                locale: detectLocale(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }, {
                onSuccess: () => {
                    setSuccessMessage(t('sign_up.success'));
                    form.reset();
                },
                onError: (ctx) => {
                    setError(ctx.error.message || t('sign_up.error_registration'));
                },
            });
        } catch (err: any) {
            setError(err.message || t('sign_up.error_unexpected'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSocial = async (provider: 'google' | 'github') => {
        const inviteCode = form.getValues().inviteCode;
        if (showInviteField && !inviteCode?.trim()) {
            setError(t('sign_up.invite_required'));
            return;
        }
        setIsLoading(true);
        await authClient.signIn.social({
            provider,
            additionalData: {
                inviteCode,
                locale: detectLocale(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            callbackURL: `${import.meta.env.VITE_FRONTEND_URL}/tracker`
        });
    };

    return (
        <div className="min-h-screen flex bg-background">
            <div className="flex-1 flex items-center justify-center p-6">
                <Card className="w-full max-w-md">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl font-bold">{t('sign_up.title')}</CardTitle>
                        <CardDescription>{t('sign_up.description')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                            {successMessage && <Alert variant="default"><AlertDescription className="text-green-600">{successMessage}</AlertDescription></Alert>}

                            <TextField
                                name="name"
                                label={t('sign_up.name')}
                                form={form}
                                placeholder={t('sign_up.name_placeholder')}
                            />

                            <TextField
                                name="email"
                                label={t('sign_up.email')}
                                form={form}
                                placeholder="name@example.com"
                            />

                            <PasswordField
                                name="password"
                                label={t('sign_up.password')}
                                form={form}
                                placeholder="••••••••"
                            />

                            <PasswordField
                                name="passwordConfirm"
                                label={t('sign_up.password_confirm')}
                                form={form}
                                placeholder="••••••••"
                            />

                            {showInviteField && (
                                <TextField
                                    name="inviteCode"
                                    label={t('sign_up.invite_code')}
                                    form={form}
                                    placeholder="ABC123XYZ"
                                    disabled={!!urlInviteCode}
                                />
                            )}

                            <Button className="w-full" type="submit" disabled={isLoading}>
                                {isLoading ? t('sign_up.submitting') : t('sign_up.submit')}
                            </Button>
                        </form>

                        {(authSettings?.googleLoginEnabled || authSettings?.githubLoginEnabled) && (
                            <div className="mt-6">
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">{t('social.divider')}</span></div>
                                </div>

                                <div className={`mt-6 grid gap-4 ${authSettings?.googleLoginEnabled && authSettings?.githubLoginEnabled ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                    {authSettings?.googleLoginEnabled && (
                                        <Button variant="outline" onClick={() => handleSocial('google')} disabled={isLoading}>
                                            <GoogleIcon /> {t('social.google')}
                                        </Button>
                                    )}
                                    {authSettings?.githubLoginEnabled && (
                                        <Button variant="outline" onClick={() => handleSocial('github')} disabled={isLoading}>
                                            <GithubIcon /> {t('social.github')}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter>
                        <p className="text-center text-sm text-muted-foreground w-full">
                            {t('sign_up.already_have_account')} <Button variant="link" onClick={() => navigate('/signin')}>{t('sign_up.signin_link')}</Button>
                        </p>
                    </CardFooter>
                </Card>
            </div>

            <div className="hidden lg:flex w-1/2 bg-muted relative overflow-hidden items-center justify-center">
                {/* Existing decorative content */}
            </div>
        </div>
    );
}
