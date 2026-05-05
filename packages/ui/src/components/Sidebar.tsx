// src/components/layout/AppSidebar.tsx
import { Calendar, Home, Inbox, Search, Settings, Users } from "lucide-react"
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from "./ui/sidebar"
import { NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"


type MenuItem = {
    title: string
    url: string
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}


interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
    menuItems?: MenuItem[]
    groupLabel?: string
}

export function AppSidebar({ menuItems, groupLabel = "Application", ...props }: AppSidebarProps) {
    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {menuItems?.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild tooltip={item.title}>
                                        <NavLink
                                            to={item.url}
                                            className={({ isActive }) =>
                                                cn(
                                                    "flex items-center gap-2",
                                                    isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                                                )
                                            }
                                        >
                                            <item.icon className="h-5 w-5" />
                                            <span>{item.title}</span>
                                        </NavLink>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* You can add more groups: Analytics, Team, etc. */}
            </SidebarContent>
            <SidebarRail />
        </Sidebar>
    )
}