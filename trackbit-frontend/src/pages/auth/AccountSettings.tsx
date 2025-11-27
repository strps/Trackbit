import { useState } from "react";

import {
    User, Lock, Bell, Shield,
    Download, Trash2, Mail,
    Smartphone, Upload, Save, Loader2
} from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
// --- Types ---

type Tab = 'general' | 'security' | 'notifications' | 'data';

interface UserSettings {
    fullName: string;
    email: string;
    bio: string;
    language: string;
    twoFactorEnabled: boolean;
    emailNotifications: boolean;
    pushNotifications: boolean;
    marketingEmails: boolean;
}

// --- Mock Data ---

const initialSettings: UserSettings = {
    fullName: "Alex Johnson",
    email: "alex@example.com",
    bio: "Productivity enthusiast and early bird.",
    language: "en",
    twoFactorEnabled: true,
    emailNotifications: true,
    pushNotifications: false,
    marketingEmails: false,
};


const AccountSettings = () => {
    const [activeTab, setActiveTab] = useState<Tab>('general');
    const [settings, setSettings] = useState<UserSettings>(initialSettings);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = () => {
        setIsSaving(true);
        // Simulate API call
        setTimeout(() => setIsSaving(false), 1000);
    };

    const menuItems = [
        { id: 'general', label: 'General', icon: User },
        { id: 'security', label: 'Security', icon: Lock },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'data', label: 'Data & Privacy', icon: Shield },
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8 font-sans text-slate-900 dark:text-slate-100">

            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Manage your profile preferences and security settings.
                    </p>
                </div>

                <div className="flex flex-col lg:flex-row gap-8">

                    {/* Sidebar Navigation */}
                    <aside className="lg:w-1/4">
                        <nav className="flex lg:flex-col space-x-2 lg:space-x-0 lg:space-y-1 overflow-x-auto pb-2 lg:pb-0">
                            {menuItems.map((item) => {
                                const isActive = activeTab === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveTab(item.id as Tab)}
                                        className={`
                      flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap
                      ${isActive
                                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-50'
                                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-50 dark:hover:bg-slate-800'}
                    `}
                                    >
                                        <item.icon className="w-4 h-4" />
                                        {item.label}
                                    </button>
                                );
                            })}
                        </nav>
                    </aside>

                    {/* Content Area */}
                    <div className="flex-1 space-y-6">

                        {/* --- GENERAL TAB --- */}
                        {activeTab === 'general' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

                                {/* Avatar Section */}
                                <Card className="p-6">
                                    <div className="flex flex-col sm:flex-row items-center gap-6">
                                        <div className="relative">
                                            <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border-2 border-slate-200 dark:border-slate-700">
                                                <img
                                                    src="https://github.com/shadcn.png"
                                                    alt="Avatar"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <button className="absolute bottom-0 right-0 p-1.5 bg-blue-600 rounded-full text-white hover:bg-blue-700 border-2 border-white dark:border-slate-900">
                                                <Upload className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <div className="space-y-1 text-center sm:text-left">
                                            <h3 className="text-lg font-medium">Profile Picture</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                JPG, GIF or PNG. Max size of 800K.
                                            </p>
                                        </div>
                                    </div>
                                </Card>

                                {/* Profile Form */}
                                <Card className="p-6 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Full Name</Label>
                                            <Input
                                                value={settings.fullName}
                                                onChange={(e) => setSettings({ ...settings, fullName: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Email</Label>
                                            <Input
                                                type="email"
                                                value={settings.email}
                                                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Bio</Label>
                                        <Textarea
                                            value={settings.bio}
                                            onChange={(e) => setSettings({ ...settings, bio: e.target.value })}
                                            placeholder="Tell us a little about yourself"
                                        />
                                        <p className="text-xs text-slate-500">
                                            This will be displayed on your public profile.
                                        </p>
                                    </div>

                                    <div className="pt-4 flex justify-end">
                                        <Button onClick={handleSave} >
                                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Save Changes
                                        </Button>
                                    </div>
                                </Card>
                            </div>
                        )}

                        {/* --- SECURITY TAB --- */}
                        {activeTab === 'security' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <Card className="p-6 space-y-4">
                                    <h3 className="text-lg font-medium">Password</h3>
                                    <div className="space-y-4 max-w-md">
                                        <div className="space-y-2">
                                            <Label>Current Password</Label>
                                            <Input type="password" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>New Password</Label>
                                            <Input type="password" />
                                        </div>
                                        <Button variant="outline">Update Password</Button>
                                    </div>
                                </Card>

                                <Card className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <h3 className="text-lg font-medium">Two-factor Authentication</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                Add an extra layer of security to your account.
                                            </p>
                                        </div>
                                        <Switch
                                            checked={settings.twoFactorEnabled}
                                            onCheckedChange={(c) => setSettings({ ...settings, twoFactorEnabled: c })}
                                        />
                                    </div>
                                </Card>
                            </div>
                        )}

                        {/* --- NOTIFICATIONS TAB --- */}
                        {activeTab === 'notifications' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <Card className="p-6 divide-y divide-slate-100 dark:divide-slate-800">
                                    <div className="flex items-center justify-between py-4 first:pt-0">
                                        <div className="flex gap-4">
                                            <div className="p-2 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600">
                                                <Mail className="w-5 h-5" />
                                            </div>
                                            <div className="space-y-0.5">
                                                <h3 className="font-medium">Email Notifications</h3>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    Receive daily summaries of your habits.
                                                </p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={settings.emailNotifications}
                                            onCheckedChange={(c) => setSettings({ ...settings, emailNotifications: c })}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between py-4">
                                        <div className="flex gap-4">
                                            <div className="p-2 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600">
                                                <Smartphone className="w-5 h-5" />
                                            </div>
                                            <div className="space-y-0.5">
                                                <h3 className="font-medium">Push Notifications</h3>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    Receive real-time alerts on your mobile devices.
                                                </p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={settings.pushNotifications}
                                            onCheckedChange={(c) => setSettings({ ...settings, pushNotifications: c })}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between py-4 last:pb-0">
                                        <div className="flex gap-4">
                                            <div className="p-2 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-600">
                                                <Shield className="w-5 h-5" />
                                            </div>
                                            <div className="space-y-0.5">
                                                <h3 className="font-medium">Marketing Emails</h3>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    Receive news about new features and updates.
                                                </p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={settings.marketingEmails}
                                            onCheckedChange={(c) => setSettings({ ...settings, marketingEmails: c })}
                                        />
                                    </div>
                                </Card>
                            </div>
                        )}

                        {/* --- DATA TAB --- */}
                        {activeTab === 'data' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <Card className="p-6 space-y-4">
                                    <div>
                                        <h3 className="text-lg font-medium">Export Data</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                            Download all your habit history and logs in CSV format.
                                        </p>
                                    </div>
                                    <Button variant="outline" className="gap-2">
                                        <Download className="w-4 h-4" /> Download My Data
                                    </Button>
                                </Card>

                                <Card className="p-6 border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10">
                                    <div className="space-y-4">
                                        <div>
                                            <h3 className="text-lg font-medium text-red-600 dark:text-red-400">Delete Account</h3>
                                            <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
                                                Permanently remove your Personal Account and all of its contents from the HabitTrack platform. This action is not reversible.
                                            </p>
                                        </div>
                                        <div className="flex justify-end">
                                            <Button variant="destructive" className="gap-2">
                                                <Trash2 className="w-4 h-4" /> Delete Account
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountSettings;