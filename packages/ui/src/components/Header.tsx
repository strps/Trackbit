import { useEffect, useState } from "react";
import { Button } from "./ui/button";

import {
  Flame, Menu,

  LayoutDashboard, ListTodo, BarChart3
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

import { NavLink } from "react-router-dom";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { UserNav } from "./UserNav";


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