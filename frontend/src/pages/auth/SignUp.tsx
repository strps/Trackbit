import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authClient } from '@/lib/auth-client';
import { GoogleIcon, GithubIcon } from './Icons'

export default function SignUpPage() {
    const navigate = useNavigate();

    const [searchParams] = useSearchParams();

    const urlInviteCode = searchParams.get('code') || '';
    const showInviteField = searchParams.get('invite') === 'true';

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        inviteCode: urlInviteCode,
    });
    //TODO: change this form to use react hook form
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.inviteCode.trim()) {
            setError('Invite code is required for registration.');
            return;
        }
        setIsLoading(true);
        setError(null);

        try {
            await authClient.signUp.email({
                name: formData.name,
                email: formData.email,
                password: formData.password,
                inviteCode: formData.inviteCode,
            }, {
                onSuccess: () => navigate('/dashboard'),
                onError: (ctx) => setError(ctx.error.message),
            });
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSocial = async (provider: 'google' | 'github') => {
        // For social signup, you may prompt for inviteCode separately or pass via state
        // Here we assume inviteCode is collected in the form (recommended for consistency)
        if (!formData.inviteCode.trim()) {
            setError('Invite code is required for registration.');
            return;
        }
        setIsLoading(true);
        await authClient.signIn.social({
            provider,
            state: JSON.stringify({ inviteCode: formData.inviteCode, callbackURL: '/dashboard' }),
        });
    };

    return (
        <div className="min-h-screen flex bg-background">
            {/* Left: Form */}
            <div className="flex-1 flex items-center justify-center p-6">
                <Card className="w-full max-w-md">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
                        <CardDescription>Enter your details below to get started with trackbit</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && <p className="text-destructive text-sm">{error}</p>}

                            <div className="space-y-2">
                                <Label htmlFor="name">Full name</Label>
                                <Input
                                    id="name"
                                    placeholder="John Doe"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@example.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        required
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-0 top-0"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                            {showInviteField &&
                                <div className="space-y-2">
                                    <Label htmlFor="inviteCode">Invite Code <span className="text-destructive">*</span></Label>
                                    <Input
                                        disabled={urlInviteCode != ""}
                                        id="inviteCode"
                                        placeholder="ABC123XYZ"
                                        value={formData.inviteCode}
                                        onChange={(e) => setFormData({ ...formData, inviteCode: e.target.value })}
                                        required
                                    />
                                </div>
                            }
                            <Button className="w-full" type="submit" disabled={isLoading}>
                                {isLoading ? 'Creating account...' : 'Sign up'}
                            </Button>
                        </form>

                        <div className="mt-6">
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or continue with</span></div>
                            </div>

                            <div className="mt-6 grid grid-cols-2 gap-4">
                                <Button variant="outline" onClick={() => handleSocial('google')} disabled={isLoading}>
                                    <GoogleIcon />
                                    Google
                                </Button>
                                <Button variant="outline" onClick={() => handleSocial('github')} disabled={isLoading}>
                                    <GithubIcon />
                                    GitHub
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <p className="text-center text-sm text-muted-foreground w-full">
                            Already have an account? <Button variant="link" onClick={() => navigate('/signin')}>Sign in</Button>
                        </p>
                    </CardFooter>
                </Card>
            </div>

            {/* Right: Branding – copy from original AuthPage.tsx */}
            <div className="hidden lg:flex w-1/2 bg-muted relative overflow-hidden items-center justify-center">
                {/* Paste your existing decorative and testimonial content here */}
            </div>
        </div>
    );
}