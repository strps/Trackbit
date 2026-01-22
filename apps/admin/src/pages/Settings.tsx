import React from "react";
import {
    Save,
    Globe,
    Bell,
    Shield,
    Palette,
    Mail,
    Smartphone
} from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
    Button,
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
} from "@trackbit/ui";

export default function SettingsPage() {

    const actions = [
        {
            label: "Save Changes",
            icon: <Save className="h-4 w-4" />,
            variant: "default" as const,
            onClick: () => {
                // Handle save action
            },
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
                </TabsList>

                <TabsContent value="general" className="space-y-4">
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
                                <Input id="app-name" defaultValue="Trackbit" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="support-email">Support Email</Label>
                                <Input id="support-email" type="email" defaultValue="support@trackbit.com" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="website">Website URL</Label>
                                <Input id="website" defaultValue="https://trackbit.com" />
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
                                <Checkbox id="maintenance" />
                                <Label htmlFor="maintenance">Enable Maintenance Mode</Label>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                When enabled, users will see a maintenance page instead of the dashboard.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="appearance" className="space-y-4">
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
                    <Card>
                        <CardHeader>
                            <CardTitle>Email Notifications</CardTitle>
                            <CardDescription>
                                Manage what emails are sent to users and admins.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox id="new-user" defaultChecked />
                                <Label htmlFor="new-user">New user signups</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="reports" />
                                <Label htmlFor="reports">Weekly analytics reports</Label>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="security" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Access Control</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox id="public-signup" defaultChecked />
                                <Label htmlFor="public-signup">Allow public signups</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="mfa" />
                                <Label htmlFor="mfa">Enforce Multi-Factor Authentication (MFA) for Admins</Label>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </AdminPage>
    );
}