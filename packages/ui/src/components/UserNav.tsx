import React from "react";
import { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuContent } from "./ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { LogOut, Moon, Sun, } from "lucide-react";

export interface UserNavMenuItem {
    label: string;
    icon?: React.ElementType;
    onClick?: () => void;
    href?: string;
}

export interface UserNavProps {
    user?: {
        name?: string;
        email?: string;
        image?: string | null;
    } | null;
    isLoading?: boolean;
    theme?: string;
    onThemeToggle?: () => void;
    onLogout?: () => void;
    onLogin?: () => void;
    menuItems?: UserNavMenuItem[];
}

export const UserNav = ({
    user,
    isLoading,
    theme,
    onThemeToggle,
    onLogout,
    onLogin,
    menuItems = []
}: UserNavProps) => {
    if (isLoading) {
        return <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />;
    }

    if (!user) {
        return (
            <Button variant="outline" onClick={onLogin}>
                Sign In
            </Button>
        );
    }

    const initials = user.name
        ? user.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
        : "U";

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8 border border-border">
                        <AvatarImage src={user.image || ""} alt={user.name} />
                        <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                        <p className="font-medium">{user.name}</p>
                        <p className="w-50 truncate text-xs text-muted-foreground">
                            {user.email}
                        </p>
                    </div>
                </div>
                <DropdownMenuSeparator />

                {menuItems.map((item, index) => (
                    <DropdownMenuItem key={index} onClick={item.onClick}>
                        {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                        <span>{item.label}</span>
                    </DropdownMenuItem>
                ))}

                {onThemeToggle && theme && <DropdownMenuItem onClick={onThemeToggle}>
                    <div className="relative mr-2 h-4 w-4">
                        <Sun className="absolute h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    </div>
                    <span className="capitalize">Theme: {theme}</span>
                </DropdownMenuItem>}

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={onLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

