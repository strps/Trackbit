// src/components/layout/AdminLayout.tsx
import { Outlet, useNavigate } from "react-router-dom"
import {
    Separator,
    AppSidebar,
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
    UserNav,
    useTheme,
    UserNavMenuItem,
    ThemeToggle,
} from "@trackbit/ui"

import { useLocation } from "react-router-dom"

import React from "react"
import { signOut, useSession } from "@/lib/auth-client"
import { CreditCard, Home, Settings, User, Users, Dumbbell, DoorOpen, Bug } from "lucide-react"

const menuItems = [
    { title: "Dashboard", url: "/dashboard", icon: Home },
    { title: "Users", url: "/users", icon: Users },
    { title: "Issues", url: "/issues", icon: Bug },
    { title: "Exercises", url: "/exercises", icon: Dumbbell },
    { title: "Invitations", url: "/invite", icon: DoorOpen },
    // { title: "Calendar", url: "/calendar", icon: Calendar },
    // { title: "Search", url: "/search", icon: Search },
    { title: "Settings", url: "/settings", icon: Settings },
]

export default function AdminLayout() {
    const location = useLocation()
    const pathSegments = location.pathname.split("/").filter(Boolean)

    return (
        <SidebarProvider>
            <AppSidebar menuItems={menuItems} />

            <SidebarInset>
                {/* Header */}
                <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 h-4" />

                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbLink href="/">Admin</BreadcrumbLink>
                            </BreadcrumbItem>

                            {pathSegments.map((segment, index) => {
                                const isLast = index === pathSegments.length - 1
                                const href = "/" + pathSegments.slice(0, index + 1).join("/")

                                return (
                                    <React.Fragment key={href}>
                                        <BreadcrumbSeparator className="hidden md:block" />
                                        <BreadcrumbItem>
                                            {isLast ? (
                                                <BreadcrumbPage className="capitalize">{segment}</BreadcrumbPage>
                                            ) : (
                                                <BreadcrumbLink href={href} className="capitalize">
                                                    {segment}
                                                </BreadcrumbLink>
                                            )}
                                        </BreadcrumbItem>
                                    </React.Fragment>
                                )
                            })}
                        </BreadcrumbList>
                    </Breadcrumb>

                    <div className="ml-auto flex items-center gap-4">
                        <ThemeToggle />
                        <AdminUserNav />
                    </div>
                </header>

                {/* Main content */}
                <div className="">
                    <Outlet />
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}


export const AdminUserNav = () => {
    const { data, isPending } = useSession();
    const navigate = useNavigate();
    const { theme, setTheme } = useTheme();


    const user = data?.user;
    const themes = ["light", "dark", "system"];

    const onThemeChange = () => {
        const selectedThemeIndex = themes.indexOf(theme);
        const nextTheme = themes[(selectedThemeIndex + 1) % themes.length];
        setTheme(nextTheme as "light" | "dark" | "system");
    };

    const handleLogout = async () => {
        await signOut();
        navigate('/');
    };

    const menuItems: UserNavMenuItem[] = [
        {
            label: "Profile",
            icon: User,
            onClick: () => navigate('/profile'),
        },
        {
            label: "Billing",
            icon: CreditCard,
            onClick: () => navigate('/billing'),
        },
        {
            label: "Settings",
            icon: Settings,
            onClick: () => navigate('/account-settings'),
        },
    ];

    return (
        <UserNav
            user={user}
            isLoading={isPending}
            theme={theme}
            onThemeToggle={onThemeChange}
            onLogout={handleLogout}
            onLogin={() => navigate('/signin')}
            menuItems={menuItems}
        />
    );
};