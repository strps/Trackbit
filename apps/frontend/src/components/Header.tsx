import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { NavLink } from "react-router-dom";

import {
  Flame, Menu, X, Sun, Moon,
  User, Settings, LogOut,
  LayoutDashboard, ListTodo, BarChart3, CreditCard
} from 'lucide-react';

interface NavItem {
  title: string;
  to: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { title: "Habits", to: "/habits", icon: ListTodo },
  { title: "Analytics", to: "/analytics", icon: BarChart3 },
  { title: "Exercises", to: "/exercises", icon: BarChart3 },
];

export const AppHeader: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-40 w-full border-b border-border bg-background/75 backdrop-blur transition-all ${scrolled ? 'shadow-sm' : ''}`}>
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
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary transition-colors">
            <Flame className="h-5 w-5 text-primary-foreground fill-current" />
          </div>
          <span className="hidden sm:inline-block text-foreground">HabitTrack</span>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `
                flex items-center gap-2 transition-colors hover:text-foreground
                ${isActive
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}
              `}
            >
              {item.title}
            </NavLink>
          ))}
        </nav>

        {/* Right Side Actions */}
        <div className="ml-auto flex items-center gap-2 sm:gap-4">
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

import { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuContent } from "./ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/theme-provider";
import { signOut, useSession } from "@/lib/auth-client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";

const UserNav = () => {
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

  if (isPending) {
    return <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />;
  }

  if (!user) {
    return (
      <Button variant="outline" onClick={() => navigate('/signin')}>
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
          <div className="relative mr-2 h-4 w-4">
            <Sun className="absolute h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </div>
          <span className="capitalize">Theme: {theme}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const MobileNav = ({ items, isOpen, onClose }: { items: NavItem[]; isOpen: boolean; onClose: () => void }) => {
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
            {/* <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button> */}
          </div>
        </SheetHeader>

        <div className="flex flex-col space-y-3 p-6">
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
              {item.title}
            </NavLink>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};