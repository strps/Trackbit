import React from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UseFormReturn } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert"; // Assuming shadcn alert exists
import { GoogleIcon, GithubIcon } from './Icons';
import { TextField } from '@/components/Fields/TextField';
import { PasswordField } from '@/components/Fields/PasswordField';

const signUpSchema = z.object({
    name: z.string().min(1, "Full name is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    inviteCode: z.string().optional(),
});

type SignUpFormData = z.infer<typeof signUpSchema>;

export default function SignUpPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const urlInviteCode = searchParams.get('code') || '';
    const showInviteField = searchParams.get('invite') === 'true';

    const [isLoading, setIsLoading] = React.useState(false);
    const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    const form: UseFormReturn<SignUpFormData> = useForm<SignUpFormData>({
        resolver: zodResolver(signUpSchema),
        defaultValues: {
            name: '',
            email: '',
            password: '',
            inviteCode: urlInviteCode,
        },
    });

    const onSubmit = async (data: SignUpFormData) => {
        if (showInviteField && !data.inviteCode?.trim()) {
            setError('Invite code is required for registration.');
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
            }, {
                onSuccess: () => {
                    setSuccessMessage("Account created successfully! Please check your email for a verification link to activate your account.");
                    form.reset();
                },
                onError: (ctx) => {
                    setError(ctx.error.message || 'An error occurred during registration.');
                },
            });
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSocial = async (provider: 'google' | 'github') => {
        const inviteCode = form.getValues().inviteCode;
        if (showInviteField && !inviteCode?.trim()) {
            setError('Invite code is required for registration.');
            return;
        }
        setIsLoading(true);
        await authClient.signIn.social({
            provider,
            additionalData: { inviteCode },
        });
    };

    return (
        <div className="min-h-screen flex bg-background">
            <div className="flex-1 flex items-center justify-center p-6">
                <Card className="w-full max-w-md">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
                        <CardDescription>Enter your details below to get started with Trackbit</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                            {successMessage && <Alert variant="default"><AlertDescription className="text-green-600">{successMessage}</AlertDescription></Alert>}

                            <TextField
                                name="name"
                                label="Full name"
                                form={form}
                                placeholder="John Doe"
                            />

                            <TextField
                                name="email"
                                label="Email"
                                form={form}
                                placeholder="name@example.com"
                            />

                            <PasswordField
                                name="password"
                                label="Password"
                                form={form}
                                placeholder="••••••••"
                            />

                            {showInviteField && (
                                <TextField
                                    name="inviteCode"
                                    label={'Invite Code *'}
                                    form={form}
                                    placeholder="ABC123XYZ"
                                    disabled={!!urlInviteCode}
                                />
                            )}

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
                                    <GoogleIcon /> Google
                                </Button>
                                <Button variant="outline" onClick={() => handleSocial('github')} disabled={isLoading}>
                                    <GithubIcon /> GitHub
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

            <div className="hidden lg:flex w-1/2 bg-muted relative overflow-hidden items-center justify-center">
                {/* Existing decorative content */}
            </div>
        </div>
    );
}