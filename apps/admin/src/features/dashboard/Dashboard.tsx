import React from "react";
import {
    Users,
    Dumbbell,
    Mail,
    Activity,
    ArrowUpRight,
    TrendingUp,
} from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Button,
    Avatar,
    AvatarFallback,
    AvatarImage,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    AdminPage,
} from "@trackbit/ui";

export default function Dashboard() {

    const actions = [
        {
            label: "Download Report",
            onClick: () => {
                // Handle download report action
            },
            variant: "default" as const,
        },
    ];

    return (
        <AdminPage title="Dashboard" description="Overview of your system's performance and activity." pageActions={actions}>
            {/* <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Mockup Dashboard</h2>
                    <p className="text-muted-foreground">
                        Overview of your system's performance and activity.
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" className="hidden sm:flex gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>Jan 20, 2024 - Feb 20, 2024</span>
                    </Button>
                    <Button>Download Report</Button>
                </div>
            </div> */}

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="analytics" disabled>Analytics</TabsTrigger>
                    <TabsTrigger value="reports" disabled>Reports</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="space-y-4">
                    {/* Stats Grid */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">1,234</div>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <TrendingUp className="h-3 w-3 text-green-500" />
                                    <span className="text-green-500 font-medium">+20.1%</span> from last month
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Workouts Logged</CardTitle>
                                <Dumbbell className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">+573</div>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <TrendingUp className="h-3 w-3 text-green-500" />
                                    <span className="text-green-500 font-medium">+12%</span> since last week
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Pending Invites</CardTitle>
                                <Mail className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">12</div>
                                <p className="text-xs text-muted-foreground">
                                    4 expiring soon
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Active Now</CardTitle>
                                <Activity className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">42</div>
                                <p className="text-xs text-muted-foreground">
                                    +6 since last hour
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                        {/* Activity Chart Mockup */}
                        <Card className="col-span-4">
                            <CardHeader>
                                <CardTitle>Activity Overview</CardTitle>
                                <CardDescription>
                                    Daily workout and habit logs over the last 30 days.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pl-2">
                                <div className="h-[300px] w-full flex items-end justify-between gap-2 px-4 pt-8">
                                    {[45, 25, 60, 55, 80, 40, 30, 70, 65, 90, 85, 45, 60, 75, 50, 40, 65, 55, 80, 95, 60, 45, 70, 85, 65, 50, 75, 60, 90, 80].map((h, i) => (
                                        <div
                                            key={i}
                                            className="w-full bg-primary/20 hover:bg-primary rounded-t-sm transition-all duration-300 cursor-pointer group relative"
                                            style={{ height: `${h}%` }}
                                        >
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border">
                                                {h}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between px-4 mt-2 text-xs text-muted-foreground">
                                    <span>Jan 20</span>
                                    <span>Feb 04</span>
                                    <span>Feb 20</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Recent Signups */}
                        <Card className="col-span-3">
                            <CardHeader>
                                <CardTitle>Recent Signups</CardTitle>
                                <CardDescription>
                                    New users joined this week.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-8">
                                    {[
                                        { name: "Alice Johnson", email: "alice@example.com", time: "2 mins ago", initials: "AJ" },
                                        { name: "Bob Smith", email: "bob@example.com", time: "1 hour ago", initials: "BS" },
                                        { name: "Charlie Brown", email: "charlie@example.com", time: "3 hours ago", initials: "CB" },
                                        { name: "Diana Prince", email: "diana@example.com", time: "5 hours ago", initials: "DP" },
                                        { name: "Evan Wright", email: "evan@example.com", time: "Yesterday", initials: "EW" },
                                    ].map((user, i) => (
                                        <div key={i} className="flex items-center">
                                            <Avatar className="h-9 w-9">
                                                <AvatarImage src={`/avatars/0${i + 1}.png`} alt="Avatar" />
                                                <AvatarFallback>{user.initials}</AvatarFallback>
                                            </Avatar>
                                            <div className="ml-4 space-y-1">
                                                <p className="text-sm font-medium leading-none">{user.name}</p>
                                                <p className="text-xs text-muted-foreground">{user.email}</p>
                                            </div>
                                            <div className="ml-auto font-medium text-xs text-muted-foreground">
                                                {user.time}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <Button variant="ghost" className="w-full mt-4 gap-1 text-xs">
                                    View all users <ArrowUpRight className="h-3 w-3" />
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </AdminPage>
    );
}