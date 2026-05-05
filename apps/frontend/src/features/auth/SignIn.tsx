import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { useNavigate } from 'react-router-dom';
import { authClient } from '@/shared/lib/auth-client';
import { GoogleIcon, GithubIcon } from './Icons'
import { useAuthSettings } from '@/hooks/use-auth-settings'
import { useTranslation } from 'react-i18next';

export default function SignInPage() {
    const navigate = useNavigate();
    const { t } = useTranslation('auth');
    const { data: authSettings } = useAuthSettings();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({ email: '', password: '' });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            await authClient.signIn.email({
                email: formData.email,
                password: formData.password,
            }, {
                onSuccess: () => navigate('/tracker'),
                onError: (ctx) => setError(ctx.error.message),
            });
        } catch (err: any) {
            setError(err.message || t('sign_in.error_unexpected'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSocial = async (provider: 'google' | 'github') => {
        setIsLoading(true);
        await authClient.signIn.social({
            provider,
            callbackURL: `${import.meta.env.VITE_FRONTEND_URL}/tracker`,
        });
    };

    return (
        <div className="min-h-screen flex bg-background">
            {/* Left: Form */}
            <div className="flex-1 flex items-center justify-center p-6">
                <Card className="w-full max-w-md">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl font-bold">{t('sign_in.title')}</CardTitle>
                        <CardDescription>{t('sign_in.description')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && <p className="text-destructive text-sm">{error}</p>}

                            <div className="space-y-2">
                                <Label htmlFor="email">{t('sign_in.email')}</Label>
                                <Input id="email" type="email" placeholder="name@example.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">{t('sign_in.password')}</Label>
                                <div className="relative">
                                    <Input id="password" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required />
                                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" onClick={() => setShowPassword(!showPassword)}>
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>

                            <Button className="w-full" type="submit" disabled={isLoading}>
                                {isLoading ? t('sign_in.submitting') : t('sign_in.submit')}
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
                                            <GoogleIcon />
                                            {t('social.google')}
                                        </Button>
                                    )}
                                    {authSettings?.githubLoginEnabled && (
                                        <Button variant="outline" onClick={() => handleSocial('github')} disabled={isLoading}>
                                            <GithubIcon />
                                            {t('social.github')}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4">
                        <Button variant="link" onClick={() => navigate('/forgot')}>{t('sign_in.forgot_password')}</Button>
                        <p className="text-center text-sm text-muted-foreground">
                            {t('sign_in.no_account')} <Button variant="link" onClick={() => navigate('/signup?invite=true')}>{t('sign_in.signup_link')}</Button>
                        </p>
                    </CardFooter>
                </Card>
            </div>

            {/* Right: Branding (hidden on mobile) */}
            <div className="hidden lg:flex w-1/2 bg-muted ..."> </div>
        </div>
    );
}
