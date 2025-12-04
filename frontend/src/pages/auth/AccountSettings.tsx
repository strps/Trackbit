// import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, signOut, useSession } from "@/lib/auth-client";
import { Loader2, LogOut, User } from "lucide-react";
import { ChangeEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";



const AccountSettings = () => {
    const navigate = useNavigate();
    const { data: session, isPending } = useSession();

    const [activeTab, setActiveTab] = useState('general');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [profileData, setProfileData] = useState({ name: '', image: '' });
    const [passData, setPassData] = useState({ current: '', new: '', confirm: '' });

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
        // UPDATED: Access user update via authClient.user
        await authClient.updateUser({
            name: profileData.name,
            image: profileData.image
        }, {
            onSuccess: () => setMessage({ type: 'success', text: 'Profile updated successfully' }),
            onError: (ctx) => setMessage({ type: 'error', text: ctx.error.message })
        });
        setIsLoading(false);
    };

    const handleChangePassword = async () => {
        if (passData.new !== passData.confirm) {
            setMessage({ type: 'error', text: "New passwords do not match" });
            return;
        }
        setIsLoading(true);
        // UPDATED: Access password change via authClient.user
        await authClient.changePassword({
            newPassword: passData.new,
            currentPassword: passData.current,
            revokeOtherSessions: true
        }, {
            onSuccess: () => {
                setMessage({ type: 'success', text: 'Password changed successfully' });
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

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8 font-sans text-slate-900 dark:text-slate-100">
            <div className="max-w-6xl mx-auto space-y-6">

                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
                        <p className="text-slate-500 dark:text-slate-400">Manage your profile and security.</p>
                    </div>
                    <button onClick={handleLogout} className="text-sm text-red-500 hover:underline flex items-center gap-1">
                        <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                </div>

                {message && (
                    <div className={`p-3 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {message.text}
                    </div>
                )}

                <div className="flex flex-col lg:flex-row gap-8">
                    <aside className="lg:w-1/4 flex lg:flex-col gap-2 overflow-x-auto pb-2">
                        {['general', 'security', 'data'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 rounded-md text-left capitalize ${activeTab === tab ? 'bg-slate-200 dark:bg-slate-800 font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </aside>

                    <div className="flex-1 space-y-6">

                        {activeTab === 'general' && (
                            <div className="space-y-6">
                                <div className="p-6 bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 space-y-4">
                                    <h3 className="text-lg font-medium">Profile</h3>
                                    <div className="flex items-center gap-4">
                                        <div className="w-20 h-20 rounded-full bg-slate-200 overflow-hidden">
                                            {profileData.image ? <img src={profileData.image} alt="Avatar" /> : <User className="w-full h-full p-4 text-slate-400" />}
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <Label>Profile Image URL</Label>
                                            <Input value={profileData.image} onChange={(e: ChangeEvent) => setProfileData({ ...profileData, image: e.target.value })} placeholder="https://..." />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Full Name</Label>
                                        <Input value={profileData.name} onChange={(e: ChangeEvent) => setProfileData({ ...profileData, name: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Email</Label>
                                        <Input value={session?.user?.email} disabled className="opacity-50 cursor-not-allowed" />
                                    </div>

                                    <div className="flex justify-end">
                                        <Button onClick={handleUpdateProfile}>
                                            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                            Save Changes
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'security' && (
                            <div className="space-y-6">
                                <div className="p-6 bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 space-y-4">
                                    <h3 className="text-lg font-medium">Change Password</h3>
                                    <div className="space-y-2"><Label>Current Password</Label><Input type="password" value={passData.current} onChange={(e: ChangeEvent) => setPassData({ ...passData, current: e.target.value })} /></div>
                                    <div className="space-y-2"><Label>New Password</Label><Input type="password" value={passData.new} onChange={(e: ChangeEvent) => setPassData({ ...passData, new: e.target.value })} /></div>
                                    <div className="space-y-2"><Label>Confirm Password</Label><Input type="password" value={passData.confirm} onChange={(e: ChangeEvent) => setPassData({ ...passData, confirm: e.target.value })} /></div>
                                    <div className="flex justify-end">
                                        <Button onClick={handleChangePassword}>
                                            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                            Update Password
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'data' && (
                            <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/50 rounded-lg">
                                <h3 className="text-lg font-medium text-red-600">Danger Zone</h3>
                                <p className="text-sm text-red-600/70 mb-4">Irreversible actions.</p>
                                <Button variant="destructive" onClick={() => alert("API endpoint for deletion needs to be implemented")}>Delete Account</Button>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountSettings;