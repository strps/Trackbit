import React, { useState, type ChangeEvent, type FormEventHandler } from 'react';
import {
    Mail, Lock, User, Eye, EyeOff,
    ArrowRight, CheckCircle2, Flame,
    ShieldCheck, ArrowLeft
} from 'lucide-react';
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Simple SVG for Google Logo
const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

// Simple SVG for GitHub Logo
const GithubIcon = () => (
    <svg className="w-5 h-5 fill-slate-900 dark:fill-white" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.419-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
);

const AuthPage = () => {
    // 'signin' | 'signup' | 'forgot'
    const [view, setView] = useState('signin');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        fullName: '',
    });

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit: FormEventHandler<HTMLFormElement> = (e) => {
        e.preventDefault();
        setIsLoading(true);
        // Simulate API call
        setTimeout(() => {
            setIsLoading(false);
            alert(`${view === 'signup' ? 'Account Created' : view === 'forgot' ? 'Reset Link Sent' : 'Signed In'} Successfully!`);
        }, 1500);
    };

    const toggleView = (newView: string) => {
        setView(newView);
        setFormData({ email: '', password: '', fullName: '' }); // Clear form on switch
        setShowPassword(false);
    };

    return (
        <div className="min-h-screen flex bg-white dark:bg-slate-950 font-sans selection:bg-blue-100 selection:text-blue-900">

            {/* Left Section: Form Area */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 xl:px-24 py-12">
                <div className="w-full max-w-md mx-auto space-y-8 animate-in fade-in slide-in-from-left-8 duration-500">

                    {/* Logo / Header */}
                    <div className="space-y-2">
                        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20">
                            <Flame className="w-7 h-7 text-white fill-white" />
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                            {view === 'signup' ? 'Create an account' : view === 'forgot' ? 'Reset password' : 'Welcome back'}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            {view === 'signup'
                                ? 'Start tracking your journey today.'
                                : view === 'forgot'
                                    ? 'Enter your email to receive recovery instructions.'
                                    : 'Please enter your details to sign in.'}
                        </p>
                    </div>

                    {/* Main Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">

                        {view === 'signup' && (
                            <InputField
                                label="Full Name"
                                name="fullName"
                                icon={User}
                                placeholder="John Doe"
                                value={formData.fullName}
                                onChange={handleInputChange}
                            />
                        )}

                        <InputField
                            label="Email"
                            name="email"
                            type="email"
                            icon={Mail}
                            placeholder="name@example.com"
                            value={formData.email}
                            onChange={handleInputChange}
                        />

                        {view !== 'forgot' && (
                            <div className="space-y-1.5">
                                <InputField
                                    label="Password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    icon={Lock}
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                />
                                {view === 'signin' && (
                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={() => toggleView('forgot')}
                                            className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                                        >
                                            Forgot password?
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-slate-200 dark:shadow-none transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    {view === 'signup' ? 'Sign up' : view === 'forgot' ? 'Send Reset Link' : 'Sign in'}
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    {view !== 'forgot' && (
                        <>
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-white dark:bg-slate-950 text-slate-500">Or continue with</span>
                                </div>
                            </div>

                            {/* Social Buttons */}
                            <div className="grid grid-cols-2 gap-4">
                                <button className="flex items-center justify-center gap-3 px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors font-medium text-slate-700 dark:text-slate-300 text-sm">
                                    <GoogleIcon />
                                    Google
                                </button>
                                <button className="flex items-center justify-center gap-3 px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors font-medium text-slate-700 dark:text-slate-300 text-sm">
                                    <GithubIcon />
                                    GitHub
                                </button>
                            </div>
                        </>
                    )}

                    {/* Footer Switching Logic */}
                    <div className="text-center text-sm">
                        {view === 'signin' ? (
                            <p className="text-slate-600 dark:text-slate-400">
                                Don't have an account?{' '}
                                <button onClick={() => toggleView('signup')} className="font-bold text-slate-900 dark:text-white hover:underline">
                                    Sign up
                                </button>
                            </p>
                        ) : view === 'signup' ? (
                            <p className="text-slate-600 dark:text-slate-400">
                                Already have an account?{' '}
                                <button onClick={() => toggleView('signin')} className="font-bold text-slate-900 dark:text-white hover:underline">
                                    Sign in
                                </button>
                            </p>
                        ) : (
                            <button
                                onClick={() => toggleView('signin')}
                                className="flex items-center justify-center gap-2 mx-auto font-bold text-slate-900 dark:text-white hover:underline"
                            >
                                <ArrowLeft className="w-4 h-4" /> Back to Sign in
                            </button>
                        )}
                    </div>

                </div>
            </div>

            {/* Right Section: Visual/Branding (Hidden on mobile) */}
            <div className="hidden lg:flex w-1/2 bg-slate-50 dark:bg-slate-900 relative overflow-hidden items-center justify-center">
                {/* Background decorative elements */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

                <div className="relative z-10 max-w-lg p-10 space-y-10">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold uppercase tracking-wider">
                            <ShieldCheck className="w-4 h-4" />
                            Secure & Private
                        </div>
                        <h2 className="text-5xl font-extrabold text-slate-900 dark:text-white leading-tight">
                            Build habits that <span className="text-blue-600 dark:text-blue-400">actually stick.</span>
                        </h2>
                        <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                            Join thousands of users who have transformed their daily routines with our data-driven tracking system. Consistency starts here.
                        </p>
                    </div>

                    {/* Visual Cards/Testimonials */}
                    <div className="grid gap-4">
                        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="font-bold text-slate-900 dark:text-white">Streak Protection</div>
                                <div className="text-sm text-slate-500 dark:text-slate-400">Never lose progress on sick days.</div>
                            </div>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4 opacity-80 scale-95 translate-x-4">
                            <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                                <Flame className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="font-bold text-slate-900 dark:text-white">Detailed Analytics</div>
                                <div className="text-sm text-slate-500 dark:text-slate-400">Visualize your improvement over time.</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default AuthPage;


interface InputFieldProps {
    label: string;
    name: string;
    type?: string;
    icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    placeholder?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}


const InputField = ({ label, name, type = 'text', icon: Icon, placeholder, value, onChange }: InputFieldProps) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <Field>
            <FieldLabel htmlFor={name}>{label}</FieldLabel>
            <div className="relative">
                {Icon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <Icon className="w-5 h-5" />
                    </div>
                )}
                <Input
                    id={name}
                    type={name === 'password' && showPassword ? 'text' : type}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    className={Icon ? "pl-10" : ""}
                    required
                />
                {name === 'password' && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-0 top-0 h-full p-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </Button>
                )}
            </div>
        </Field>
    );
};