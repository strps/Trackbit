import { useEffect } from "react";
import {
    Save,
    Globe,
    Bell,
    Shield,
    Palette,
    Loader2,
    Gauge,
} from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Checkbox,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Separator,
    AdminPage,
    Badge,
} from "@trackbit/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSettingsStore, type AuthSettingsDraft } from "./settings-store";
import LimitsSection from "../limits/LimitsSection";

const ADMIN_API = import.meta.env.VITE_API_URL;

interface AuthSettingsResponse {
    id: number;
    googleLoginEnabled: boolean;
    githubLoginEnabled: boolean;
    passwordLoginEnabled: boolean;
    updatedAt: string;
}

function useAuthSettings() {
    return useQuery<AuthSettingsResponse>({
        queryKey: ["admin-auth-settings"],
        queryFn: async () => {
            const res = await fetch(`${ADMIN_API}/admin/settings`, {
                credentials: "include",
            });
            if (!res.ok) throw new Error("Failed to fetch settings");
            return res.json();
        },
    });
}

function useSaveSettings() {
    const queryClient = useQueryClient();
    const syncFromServer = useSettingsStore((s: { syncFromServer: (data: AuthSettingsDraft) => void }) => s.syncFromServer);

    return useMutation({
        mutationFn: async (body: Partial<AuthSettingsDraft>) => {
            const res = await fetch(`${ADMIN_API}/admin/settings`, {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error("Failed to update settings");
            return res.json() as Promise<AuthSettingsResponse>;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["admin-auth-settings"] });
            syncFromServer(data);
        },
    });
}

export default function SettingsPage() {
    const { data: authSettings, isLoading: isLoadingSettings } = useAuthSettings();
    const saveSettings = useSaveSettings();

    const { draft, isDirty, syncFromServer, toggle, getChanges, discard } = useSettingsStore();

    // Sync store when server data arrives
    useEffect(() => {
        if (authSettings) {
            syncFromServer(authSettings);
        }
    }, [authSettings, syncFromServer]);

    const handleSave = () => {
        const changes = getChanges();
        if (changes) {
            saveSettings.mutate(changes);
        }
    };

    const actions = [
        ...(isDirty
            ? [
                {
                    label: "Discard",
                    variant: "outline" as const,
                    onClick: discard,
                },
            ]
            : []),
        {
            label: saveSettings.isPending ? "Saving..." : "Save Changes",
            icon: saveSettings.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Save className="h-4 w-4" />,
            variant: "default" as const,
            onClick: handleSave,
            disabled: !isDirty || saveSettings.isPending,
        },
    ];

    return (
        <AdminPage title="Settings" description="Manage your application preferences and configurations."
            pageActions={actions}>


            <Tabs defaultValue="general" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="general" className="gap-2"><Globe className="h-4 w-4" /> General</TabsTrigger>
                    <TabsTrigger value="appearance" className="gap-2"><Palette className="h-4 w-4" /> Appearance</TabsTrigger>
                    <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4" /> Notifications</TabsTrigger>
                    <TabsTrigger value="security" className="gap-2"><Shield className="h-4 w-4" /> Security</TabsTrigger>
                    <TabsTrigger value="limits" className="gap-2"><Gauge className="h-4 w-4" /> User Limits</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-4">
                    <Badge variant="outline" className="text-muted-foreground">Coming soon</Badge>
                    <Card>
                        <CardHeader>
                            <CardTitle>Application Information</CardTitle>
                            <CardDescription>
                                Configure the general details visible to your users.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="app-name">App Name</Label>
                                <Input id="app-name" defaultValue="Trackbit" disabled />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="support-email">Support Email</Label>
                                <Input id="support-email" type="email" defaultValue="support@trackbit.com" disabled />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="website">Website URL</Label>
                                <Input id="website" defaultValue="https://trackbit.com" disabled />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>System Status</CardTitle>
                            <CardDescription>
                                Control the availability of your application.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox id="maintenance" disabled />
                                <Label htmlFor="maintenance" className="text-muted-foreground">Enable Maintenance Mode</Label>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                When enabled, users will see a maintenance page instead of the dashboard.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="appearance" className="space-y-4">
                    <Badge variant="outline" className="text-muted-foreground">Coming soon</Badge>
                    <Card>
                        <CardHeader>
                            <CardTitle>Theme Preferences</CardTitle>
                            <CardDescription>
                                Customize how the admin dashboard looks.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2 max-w-sm">
                                <Label>Default Theme</Label>
                                <Select defaultValue="system">
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a theme" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="light">Light</SelectItem>
                                        <SelectItem value="dark">Dark</SelectItem>
                                        <SelectItem value="system">System</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="notifications" className="space-y-4">
                    <Badge variant="outline" className="text-muted-foreground">Coming soon</Badge>
                    <Card>
                        <CardHeader>
                            <CardTitle>Email Notifications</CardTitle>
                            <CardDescription>
                                Manage what emails are sent to users and admins.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox id="new-user" defaultChecked disabled />
                                <Label htmlFor="new-user" className="text-muted-foreground">New user signups</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="reports" disabled />
                                <Label htmlFor="reports" className="text-muted-foreground">Weekly analytics reports</Label>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="security" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Login Methods</CardTitle>
                            <CardDescription>
                                Control which authentication methods are available to users.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {isLoadingSettings || !draft ? (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading settings...
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="password-login"
                                            checked={draft.passwordLoginEnabled}
                                            onCheckedChange={() => toggle("passwordLoginEnabled")}
                                        />
                                        <Label htmlFor="password-login">Email &amp; Password Login</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="google-login"
                                            checked={draft.googleLoginEnabled}
                                            onCheckedChange={() => toggle("googleLoginEnabled")}
                                        />
                                        <Label htmlFor="google-login">Google Login</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="github-login"
                                            checked={draft.githubLoginEnabled}
                                            onCheckedChange={() => toggle("githubLoginEnabled")}
                                        />
                                        <Label htmlFor="github-login">GitHub Login</Label>
                                    </div>
                                    {saveSettings.isError && (
                                        <p className="text-sm text-destructive">Failed to save settings. Please try again.</p>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">Access Control <Badge variant="outline" className="text-muted-foreground font-normal">Coming soon</Badge></CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox id="public-signup" defaultChecked disabled />
                                <Label htmlFor="public-signup" className="text-muted-foreground">Allow public signups</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="mfa" disabled />
                                <Label htmlFor="mfa" className="text-muted-foreground">Enforce Multi-Factor Authentication (MFA) for Admins</Label>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="limits" className="space-y-4">
                    <LimitsSection />
                </TabsContent>
            </Tabs>
        </AdminPage>
    );
}