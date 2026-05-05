import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { useNavigate } from 'react-router-dom';
import { authClient } from '@/shared/lib/auth-client';
import { useTranslation } from 'react-i18next';

export default function ForgotPasswordPage() {
    const navigate = useNavigate();
    const { t } = useTranslation('auth');
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [email, setEmail] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            await authClient.requestPasswordReset({
                email,
            }, {
                onSuccess: () => setSuccess(t('forgot.success')),
                onError: (ctx) => setError(ctx.error.message),
            });
        } catch (err: any) {
            setError(err.message || t('sign_up.error_unexpected'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-background">
            {/* Left: Form */}
            <div className="flex-1 flex items-center justify-center p-6">
                <Card className="w-full max-w-md">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl font-bold">{t('forgot.title')}</CardTitle>
                        <CardDescription>
                            {t('forgot.description')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && <p className="text-destructive text-sm">{error}</p>}
                            {success && <p className="text-green-600 dark:text-green-400 text-sm">{success}</p>}

                            <div className="space-y-2">
                                <Label htmlFor="email">{t('forgot.email')}</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>

                            <Button className="w-full" type="submit" disabled={isLoading}>
                                {isLoading ? t('forgot.submitting') : t('forgot.submit')}
                            </Button>
                        </form>
                    </CardContent>
                    <CardFooter>
                        <Button variant="link" onClick={() => navigate('/signin')} className="w-full">
                            {t('forgot.back')}
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            {/* Right: Branding */}
            <div className="hidden lg:flex w-1/2 bg-muted relative overflow-hidden items-center justify-center">
                {/* Paste your existing decorative and testimonial content here */}
            </div>
        </div>
    );
}
