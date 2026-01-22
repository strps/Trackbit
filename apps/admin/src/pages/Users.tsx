import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import {
    MoreHorizontal,
    PlusCircle,
    File,
    ListFilter,
} from "lucide-react";

import {
    Button,
    Checkbox,
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DataTable,
    DataTableColumnHeader,
    Card,
    CardContent,
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    Avatar,
    AvatarFallback,
    AvatarImage,
    Badge,
    AdminPage,
} from "@trackbit/ui";

export interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string | Date;
    image?: string | null;
    emailVerified: boolean;
    updatedAt: string | Date;
}

const getRoleBadgeVariant = (role: string) => {
    switch (role) {
        case "admin":
            return "destructive";
        case "user":
            return "default";
        case "guest":
            return "secondary";
        default:
            return "outline";
    }
};

export const columns: ColumnDef<User>[] = [
    {
        id: "select",
        header: ({ table }) => (
            <Checkbox
                checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                aria-label="Select all"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
            />
        ),
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: "name",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="User" />
        ),
        cell: ({ row }) => {
            const user = row.original;
            const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            return (
                <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 border">
                        <AvatarImage src={user.image || ""} alt={user.name} />
                        <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="grid gap-0.5">
                        <span className="font-medium">{user.name}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                </div>
            );
        },
    },
    {
        accessorKey: "role",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Role" />
        ),
        cell: ({ row }) => (
            <Badge variant={getRoleBadgeVariant(row.getValue("role"))} className="capitalize">
                {row.getValue("role")}
            </Badge>
        ),
    },
    {
        accessorKey: "createdAt",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Created At" />
        ),
        cell: ({ row }) => (
            <div className="lowercase">
                {new Date(row.getValue("createdAt")).toLocaleDateString()}
            </div>
        ),
    },
    {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => {
            const user = row.original;
            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                            onClick={() => navigator.clipboard.writeText(user.id)}
                        >
                            Copy user ID
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>View details</DropdownMenuItem>
                        <DropdownMenuItem>Edit user</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">Delete user</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];

const useUsers = () => {
    return useQuery({
        queryKey: ["users"],
        queryFn: async () => {
            const { data, error } = await authClient.admin.listUsers({
                query: {
                    limit: 100,
                },
            });
            if (error) {
                throw new Error(error.message);
            }
            return (data?.users || []) as User[];
        },
    });
};

export default function UsersPage() {
    const { data: users = [], isLoading } = useUsers();

    const actions = [
        {
            label: "Export",
            icon: <File className="h-4 w-4" />,
            variant: "outline" as const,
            onClick: () => {
                // Handle export action
            },
        },
        {
            label: "Add User",
            icon: <PlusCircle className="h-4 w-4" />,
            onClick: () => {
                // Handle add user action
            },
        },
    ];

    return (
        <AdminPage title="Users" description="Manage all users in the system." pageActions={actions}>

            <Tabs defaultValue="all">
                <div className="flex items-center">
                    <TabsList>
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="admin">Admins</TabsTrigger>
                        <TabsTrigger value="user">Users</TabsTrigger>
                        <TabsTrigger value="guest" className="hidden sm:flex">Guests</TabsTrigger>
                    </TabsList>
                    <div className="ml-auto flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1">
                                    <ListFilter className="h-3.5 w-3.5" />
                                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                        Filter
                                    </span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuCheckboxItem checked>
                                    Active
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem>
                                    Inactive
                                </DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
                {isLoading ? (
                    <div className="p-8 text-center text-muted-foreground">Loading users...</div>
                ) : (
                    ["all", "admin", "user", "guest"].map((tab) => (
                        <TabsContent key={tab} value={tab}>
                            <Card>
                                <CardContent className="p-0">
                                    <DataTable
                                        columns={columns}
                                        data={tab === "all" ? users : users.filter((user) => user.role === tab)}
                                        searchColumn="email"
                                    />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    ))
                )}
            </Tabs>
        </AdminPage>
    );
}