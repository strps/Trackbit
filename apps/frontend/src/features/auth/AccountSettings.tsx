import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { authClient, signOut, useSession } from "@/shared/lib/auth-client";
import { useUnitSystem } from "@/providers/unit-system-provider";
import { Loader2, LogOut, User } from "lucide-react";
import { ChangeEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";

const API_URL = import.meta.env.VITE_API_URL;

const AccountSettings = () => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation('auth');
    const { t: tNav } = useTranslation('nav');
    const { data: session, isPending } = useSession();
    const { unitSystem, setUnitSystem } = useUnitSystem();
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState('general');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [profileData, setProfileData] = useState({ name: '', image: '' });
    const [passData, setPassData] = useState({ current: '', new: '', confirm: '' });

    const locale = i18n.language.startsWith('es') ? 'es' : 'en';

    const handleLocaleChange = async (next: string) => {
        i18n.changeLanguage(next);
        if (session?.user) {
            await fetch(`${API_URL}/me/preferences`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ locale: next }),
            });
        }
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['exercises'] }),
            queryClient.invalidateQueries({ queryKey: ['muscle-groups'] }),
        ]);
        setMessage({ type: 'success', text: t('account.message.preferences_updated') });
    };

    const handleUnitSystemChange = (next: string) => {
        const us = next as 'metric' | 'imperial';
        setUnitSystem(us);
        if (session?.user) {
            fetch(`${API_URL}/me/preferences`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ unitSystem: us }),
            });
        }
        setMessage({ type: 'success', text: t('account.message.preferences_updated') });
    };

    useEffect(() => {
        if (session?.user) {
            setProfileData({
                name: session.user.name || '',
                image: session.user.image || ''
            });
        }
    }, [session]);

    const handleUpdateProfile = async () => {
        setIsLoading(true);
        setMessage(null);
        await authClient.updateUser({
            name: profileData.name,
            image: profileData.image
        }, {
            onSuccess: () => setMessage({ type: 'success', text: t('account.message.profile_updated') }),
            onError: (ctx) => setMessage({ type: 'error', text: ctx.error.message })
        });
        setIsLoading(false);
    };

    const handleChangePassword = async () => {
        if (passData.new !== passData.confirm) {
            setMessage({ type: 'error', text: t('account.message.passwords_mismatch') });
            return;
        }
        setIsLoading(true);
        await authClient.changePassword({
            newPassword: passData.new,
            currentPassword: passData.current,
            revokeOtherSessions: true
        }, {
            onSuccess: () => {
                setMessage({ type: 'success', text: t('account.message.password_changed') });
                setPassData({ current: '', new: '', confirm: '' });
            },
            onError: (ctx) => setMessage({ type: 'error', text: ctx.error.message })
        });
        setIsLoading(false);
    };

    const handleLogout = async () => {
        await signOut();
        navigate('/auth');
    }

    if (isPending) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

    const tabs = ['general', 'security', 'data'] as const;

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 font-sans text-foreground">
            <div className="max-w-6xl mx-auto space-y-6">

                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{t('account.title')}</h1>
                        <p className="text-muted-foreground">{t('account.subtitle')}</p>
                    </div>
                    <button onClick={handleLogout} className="text-sm text-destructive hover:underline flex items-center gap-1">
                        <LogOut className="w-4 h-4" /> {t('account.sign_out')}
                    </button>
                </div>

                {message && (
                    <div className={`p-3 rounded-md ${message.type === 'success' ? 'bg-green-500/15 text-green-700 dark:text-green-400' : 'bg-destructive/15 text-destructive'}`}>
                        {message.text}
                    </div>
                )}

                <div className="flex flex-col lg:flex-row gap-8">
                    <aside className="lg:w-1/4 flex lg:flex-col gap-2 overflow-x-auto pb-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 rounded-md text-left ${activeTab === tab ? 'bg-muted font-medium' : 'hover:bg-muted/50'}`}
                            >
                                {t(`account.tab.${tab}`)}
                            </button>
                        ))}
                    </aside>

                    <div className="flex-1 space-y-6">

                        {activeTab === 'general' && (
                            <div className="p-6 bg-card text-card-foreground rounded-lg border shadow-sm space-y-4">
                                <h3 className="text-lg font-medium">{t('account.profile.heading')}</h3>
                                <div className="flex items-center gap-4">
                                    <div className="w-20 h-20 rounded-full bg-muted overflow-hidden">
                                        {profileData.image ? <img src={profileData.image} alt="Avatar" /> : <User className="w-full h-full p-4 text-muted-foreground" />}
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <Label>{t('account.profile.image_url')}</Label>
                                        <Input
                                            value={profileData.image}
                                            onChange={(e: ChangeEvent<HTMLInputElement>) => setProfileData({ ...profileData, image: e.target.value })}
                                            placeholder="https://..." />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('account.profile.name')}</Label>
                                    <Input
                                        type="text"
                                        value={profileData.name}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) => setProfileData({ ...profileData, name: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('account.profile.email')}</Label>
                                    <Input value={session?.user?.email} disabled className="opacity-50 cursor-not-allowed" />
                                </div>
                                <div className="flex justify-end">
                                    <Button onClick={handleUpdateProfile}>
                                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {t('account.profile.save')}
                                    </Button>
                                </div>

                                <hr className="border-border" />

                                <h3 className="text-lg font-medium">{t('account.preferences.heading')}</h3>
                                <div className="space-y-2">
                                    <Label>{t('account.preferences.language')}</Label>
                                    <Select value={locale} onValueChange={handleLocaleChange}>
                                        <SelectTrigger className="w-48">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="en">{tNav('language_en')}</SelectItem>
                                            <SelectItem value="es">{tNav('language_es')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('account.preferences.units')}</Label>
                                    <Select value={unitSystem} onValueChange={handleUnitSystemChange}>
                                        <SelectTrigger className="w-48">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="metric">{tNav('unit_metric')}</SelectItem>
                                            <SelectItem value="imperial">{tNav('unit_imperial')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        {activeTab === 'security' && (
                            <div className="space-y-6">
                                <div className="p-6 bg-card text-card-foreground rounded-lg border shadow-sm space-y-4">
                                    <h3 className="text-lg font-medium">{t('account.security.heading')}</h3>
                                    <div className="space-y-2">
                                        <Label>{t('account.security.current')}</Label>
                                        <Input
                                            type="password"
                                            value={passData.current}
                                            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassData({ ...passData, current: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t('account.security.new')}</Label>
                                        <Input
                                            type="password"
                                            value={passData.new}
                                            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassData({ ...passData, new: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t('account.security.confirm')}</Label>
                                        <Input type="password"
                                            value={passData.confirm}
                                            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassData({ ...passData, confirm: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex justify-end">
                                        <Button onClick={handleChangePassword}>
                                            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                            {t('account.security.update')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'data' && (
                            <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-lg">
                                <h3 className="text-lg font-medium text-destructive">{t('account.data.heading')}</h3>
                                <p className="text-sm text-destructive/80 mb-4">{t('account.data.description')}</p>
                                <Button variant="destructive" onClick={() => alert("API endpoint for deletion needs to be implemented")}>{t('account.data.delete')}</Button>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountSettings;
