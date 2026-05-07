import { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuContent, DropdownMenuLabel } from "./ui/dropdown-menu";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { NavLink } from "react-router-dom";
import {
    Flame, Menu, X, Sun, Moon,
    User, Settings, LogOut,
    LayoutDashboard, ListTodo, BarChart3, Dumbbell, CreditCard, ChevronDown, Bug, Scale
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/theme-provider";
import { useUnitSystem } from "@/providers/unit-system-provider";
import { signOut, useSession } from "@/shared/lib/auth-client";
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { LogoNameLeft } from "./Logo";
import { FeedbackModal } from "./FeedbackModal";

interface NavItem {
    titleKey: ParseKeys<'nav'>;
    to: string;
    icon: React.ElementType;
}

const navItems: NavItem[] = [
    { titleKey: "tracker", to: "/tracker", icon: Flame },
    { titleKey: "stats", to: "/stats", icon: BarChart3 },
];

const configNavItems: NavItem[] = [
    { titleKey: "habits", to: "/config/habits", icon: ListTodo },
    { titleKey: "exercises", to: "/config/exercises", icon: Dumbbell },
];

export const AppHeader: React.FC = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [feedbackOpen, setFeedbackOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <>
            <header className={`sticky top-0 z-40 w-full border-b border-border bg-background/75 backdrop-blur transition-all ${scrolled ? 'shadow-sm' : ''}`}>
                <div className="container max-w-full mx-auto flex h-16 items-center justify-between px-4 sm:px-8 ">

                    {/* Logo */}
                    <LogoNameLeft className="h-12 fill-foreground shrink" />


                    {/* Desktop Navigation */}
                    <div className="flex ml-9">
                        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium mr-6">
                            <DesktopNavItems items={navItems} />
                            <ConfigDropdown />
                        </nav>

                        {/* Mobile Menu Trigger */}
                        <div className="mr-4 lg:hidden">
                            <MobileMenuTrigger onOpen={() => setMobileMenuOpen(true)} />
                        </div>
                        {/* Right Side Actions */}
                        <div className="ml-auto flex items-center gap-2 sm:gap-4">
                            <UserNav onOpenFeedback={() => setFeedbackOpen(true)} />
                        </div>

                        {/* Mobile Menu Sheet */}
                        <MobileNav
                            items={navItems}
                            configItems={configNavItems}
                            isOpen={mobileMenuOpen}
                            onClose={() => setMobileMenuOpen(false)}
                        />
                    </div>
                </div>

            </header>
            <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
        </>
    );
};

export default AppHeader;



const API_URL = import.meta.env.VITE_API_URL;

const DesktopNavItems = ({ items }: { items: NavItem[] }) => {
    const { t } = useTranslation('nav');
    return (
        <>
            {items.map((item) => (
                <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `flex items-center gap-2 transition-colors hover:text-foreground ${isActive ? "text-foreground font-semibold" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}
                >
                    {t(item.titleKey)}
                </NavLink>
            ))}
        </>
    );
};

const MobileMenuTrigger = ({ onOpen }: { onOpen: () => void }) => {
    const { t } = useTranslation('nav');
    return (
        <Button variant="ghost" size="icon" onClick={onOpen}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">{t('toggle_menu')}</span>
        </Button>
    );
};

const UserNav = ({ onOpenFeedback }: { onOpenFeedback: () => void }) => {
    const { data, isPending } = useSession();
    const navigate = useNavigate();
    const { theme, setTheme } = useTheme();
    const { unitSystem, setUnitSystem } = useUnitSystem();
    const { t } = useTranslation('nav');

    const user = data?.user;
    const themes = ["light", "dark", "system"];

    const onThemeChange = () => {
        const selectedThemeIndex = themes.indexOf(theme);
        const nextTheme = themes[(selectedThemeIndex + 1) % themes.length];
        setTheme(nextTheme as "light" | "dark" | "system");
    };

    const handleUnitSystemChange = () => {
        const next = unitSystem === 'metric' ? 'imperial' : 'metric';
        setUnitSystem(next);
        if (user) {
            fetch(`${API_URL}/api/me/preferences`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ unitSystem: next }),
            });
        }
    };

    const handleLogout = async () => {
        await signOut();
        navigate('/');
    };

    if (isPending) {
        return <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />;
    }

    if (!user) {
        return (
            <Button variant="outline" onClick={() => navigate('/signin')}>
                {t('sign_in')}
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

                <DropdownMenuLabel className="text-muted-foreground">{t('my_account')}</DropdownMenuLabel>

                <DropdownMenuItem onClick={() => navigate('/account-settings')}>
                    <User className="mr-2 h-4 w-4" />
                    <span>{t('profile')}</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={onThemeChange}>
                    <div className="relative mr-2 h-4 w-4">
                        <Sun className="absolute h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    </div>
                    <span className="capitalize">{t('theme', { theme })}</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={handleUnitSystemChange}>
                    <Scale className="mr-2 h-4 w-4" />
                    <span>{t('unit_label', { unit: t(unitSystem === 'metric' ? 'unit_metric' : 'unit_imperial') })}</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t('log_out')}</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={onOpenFeedback}>
                    <Bug className="mr-2 h-4 w-4" />
                    <span>{t('report_bug')}</span>
                </DropdownMenuItem>

            </DropdownMenuContent>
        </DropdownMenu>
    );
};

const MobileNav = ({ items, configItems, isOpen, onClose }: { items: NavItem[]; configItems: NavItem[]; isOpen: boolean; onClose: () => void }) => {
    const { t } = useTranslation('nav');
    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent side="left" className="w-3/4 max-w-sm p-0 lg:hidden">
                <SheetHeader className="border-b border-border p-6">
                    <div className="flex items-center justify-between">
                        <SheetTitle className="flex items-center gap-2 font-bold text-xl">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                                <Flame className="h-5 w-5 text-primary-foreground fill-current" />
                            </div>
                            <span>Trackbit</span>
                        </SheetTitle>
                    </div>
                </SheetHeader>

                <div className="flex flex-col p-6 gap-6">
                    <div className="flex flex-col space-y-1">
                        {items.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                onClick={onClose}
                                className={({ isActive }) => `
                flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
                ${isActive
                                        ? "bg-accent text-accent-foreground"
                                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}
              `}
                            >
                                <item.icon className="h-4 w-4" />
                                {t(item.titleKey)}
                            </NavLink>
                        ))}
                    </div>

                    <div className="flex flex-col space-y-1">
                        <p className="px-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('configuration')}</p>
                        {configItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                onClick={onClose}
                                className={({ isActive }) => `
                flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
                ${isActive
                                        ? "bg-accent text-accent-foreground"
                                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}
              `}
                            >
                                <item.icon className="h-4 w-4" />
                                {t(item.titleKey)}
                            </NavLink>
                        ))}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
};

const ConfigDropdown = () => {
    const navigate = useNavigate();
    const { t } = useTranslation('nav');

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                {t('configuration')}
                <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                {configNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <DropdownMenuItem key={item.to} onClick={() => navigate(item.to)}>
                            <Icon className="mr-2 h-4 w-4" />
                            <span>{t(item.titleKey)}</span>
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
