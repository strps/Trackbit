import { Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@trackbit/ui';
import { Input } from '@trackbit/ui';
import { Button } from '@trackbit/ui';
import { Label } from '@trackbit/ui';
import { useNavigate } from 'react-router-dom';
import { authClient } from '@/lib/auth-client';
import { GoogleIcon, GithubIcon } from './Icons'
import { useState } from 'react';

export const Home = () => {
    const navigate = useNavigate();
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
                // inviteCode: formData.inviteCode || undefined, // Optional if not required for sign-in
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
        setIsLoading(true);
        await authClient.signIn.social({
            provider,
            // Pass inviteCode via state if collected separately
            callbackURL: `${import.meta.env.VITE_FRONTEND_URL}/dashboard`,
        });
    };

    return (
        <div className="min-h-screen flex bg-background">
            {/* Left: Form */}
            <div className="flex-1 flex items-center justify-center p-6">
                <Card className="w-full max-w-md">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl font-bold text-center">Trackbit Admin</CardTitle>
                        <CardDescription>Enter your email and password below to access your account</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && <p className="text-destructive text-sm">{error}</p>}

                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" type="email" placeholder="name@example.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <div className="relative">
                                    <Input id="password" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required />
                                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" onClick={() => setShowPassword(!showPassword)}>
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>

                            <Button className="w-full" type="submit" disabled={isLoading}>
                                {isLoading ? 'Signing in...' : 'Sign in'}
                            </Button>
                        </form>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4">
                        <Button variant="link" onClick={() => navigate('/forgot')}>Forgot password?</Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}