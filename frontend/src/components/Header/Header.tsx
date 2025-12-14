import { useEffect, useState } from "react";
import { Button } from "../ui/button";

import {
  Flame, Menu, X, Sun, Moon,
  User, Settings, LogOut,
  LayoutDashboard, ListTodo, BarChart3, CreditCard
} from 'lucide-react';


interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  active?: boolean;
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, active: true },
  { title: "Habits", href: "/habits", icon: ListTodo },
  { title: "Analytics", href: "/analytics", icon: BarChart3 },
  { title: "Exercises", href: "/exercises", icon: BarChart3 },
  { title: "Tracker", href: "/tracker", icon: BarChart3 },

];


export const AppHeader: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Add shadow on scroll
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/75 dark:bg-slate-950/75 backdrop-blur transition-all ${scrolled ? 'shadow-sm' : ''}`}>
      <div className="container mx-auto flex h-16 items-center px-4 sm:px-8">

        {/* Mobile Menu Trigger */}
        <div className="mr-4 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </div>

        {/* Logo */}
        <div className="mr-8 flex items-center gap-2 font-bold text-xl tracking-tight">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 dark:bg-blue-600 transition-colors">
            <Flame className="h-5 w-5 text-white fill-current" />
          </div>
          <span className="hidden sm:inline-block text-slate-900 dark:text-white">HabitTrack</span>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-2 transition-colors hover:text-slate-900 dark:hover:text-slate-50
                ${item.active ? "text-slate-900 dark:text-slate-50 font-semibold" : "text-slate-500 dark:text-slate-400"}
              `}
            >
              {item.title}
            </a>
          ))}
        </nav>

        {/* Right Side Actions */}
        <div className="ml-auto flex items-center gap-2 sm:gap-4">

          {/* Theme Toggle */}


          {/* User Profile */}
          <UserNav />
        </div>
      </div>

      {/* Mobile Menu Sheet */}
      <MobileNav
        items={navItems}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
    </header>
  );
};

export default AppHeader;

import { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuContent } from "../ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/theme-provider";
import { signOut, useSession } from "@/lib/auth-client";



const UserNav = () => {

  const { data, isPending } = useSession()
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme()

  const user = data?.user;
  const themes = ["light", "dark", "system"];

  const onThemeChange = () => {
    const selectedThemeIndex = themes.indexOf(theme)
    const nextTheme = themes[(selectedThemeIndex + 1) % themes.length];
    setTheme(nextTheme as "light" | "dark" | "system");
  }

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  // Loading State
  if (isPending) {
    return <div className="h-8 w-8 rounded-full bg-slate-200 animate-pulse dark:bg-slate-800" />;
  }

  // Not Logged In State
  if (!user) {
    return (
      <Button variant="outline" onClick={() => navigate('/auth')}>
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
          <Avatar className="h-8 w-8 border border-slate-200 dark:border-slate-700">
            {/* BetterAuth uses 'image', fallback to avatarUrl if you have custom fields */}
            <AvatarImage src={user.image || (user).image || ""} alt={user.name} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56" align="end" forceMount>
        {/* User Info Header */}
        <div className="flex items-center justify-start gap-2 p-2">
          <div className="flex flex-col space-y-1 leading-none">
            <p className="font-medium">{user.name}</p>
            <p className="w-[200px] truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => navigate('/profile')}>
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => navigate('/billing')}>
          <CreditCard className="mr-2 h-4 w-4" />
          <span>Billing</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => navigate('/account-settings')}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={onThemeChange}>
          {/* Theme Icon Switcher */}
          <div className="relative mr-2 h-4 w-4">
            <Sun className="absolute h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </div>
          <span className="capitalize">Theme: {theme}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    //Add buttom bug buttons (sugerences and bug reporting) and user role tester
  );

};


const MobileNav = ({ items, isOpen, onClose }: { items: NavItem[], isOpen: boolean, onClose: () => void }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 lg:hidden animate-in fade-in" onClick={onClose}>
      <div
        className="fixed inset-y-0 left-0 z-50 h-full w-3/4 max-w-sm gap-4 border-r border-slate-200 bg-white p-6 shadow-xl transition-transform animate-in slide-in-from-left duration-300 dark:border-slate-800 dark:bg-slate-950 sm:max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2 font-bold text-xl">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 dark:bg-slate-50">
              <Flame className="h-5 w-5 text-slate-50 dark:text-slate-900 fill-current" />
            </div>
            <span>HabitTrack</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-col space-y-3">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => { e.preventDefault(); onClose(); }}
              className={`
                flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
                ${item.active
                  ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-50"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50"}
              `}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};
