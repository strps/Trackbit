import * as React from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import {
    MoreHorizontal,
    PlusCircle,
    File,
    ListFilter,
    Mail,
    Copy,
    Trash,
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
    DataTableActions,
    Card,
    CardContent,
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    Badge,
    AdminPage,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DynamicForm,
    FormFieldConfig,
} from "@trackbit/ui";

// Define invite type based on schema
interface Invite {
    id: number;
    code: string;
    email: string | null;
    role: string;
    maxUses: number;
    uses: number;
    createdAt: Date | null;
    // Add other fields as needed (e.g., expiresAt, consumedAt)
}

// Define form values type
interface InvitationFormValues {
    email: string;
    role: string;
    maxUses: number;
    emailListFile?: File | null;  // Optional file for batch
}

// Custom hook for managing invites state with Tanstack Query
function useInvites() {
    const queryClient = useQueryClient();

    const { data: invites = [], isLoading } = useQuery<Invite[]>({
        queryKey: ["invites"],
        queryFn: async () => {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/invitations`, {
                credentials: "include",
            });
            if (!res.ok) {
                throw new Error("Failed to fetch invites");
            }
            return res.json();
        },
    });

    const mutation = useMutation({
        mutationFn: async (formData: FormData) => {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/invitations`, {
                method: "POST",
                body: formData,
                credentials: "include",
            });
            if (!res.ok) {
                throw new Error("Failed to send invitations");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["invites"] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/invitations/${id}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (!res.ok) throw new Error("Failed to delete invitation");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["invites"] });
        },
    });

    const deleteBatchMutation = useMutation({
        mutationFn: async (ids: number[]) => {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/invitations`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids }),
                credentials: "include",
            });
            if (!res.ok) throw new Error("Failed to delete invitations");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["invites"] });
        },
    });

    return {
        invites,
        isLoading,
        sendInvites: mutation.mutate,
        deleteInvite: deleteMutation.mutate,
        deleteInvites: deleteBatchMutation.mutate,
        isSending: mutation.isPending,
        error: mutation.error,
    };
}

const getRoleBadgeVariant = (role: string) => {
    switch (role) {
        case "admin":
            return "destructive";
        case "user":
            return "default";
        case "tester":
            return "secondary";
        default:
            return "outline";
    }
};

const getColumns = (onDelete: (id: number) => void): ColumnDef<Invite>[] => [
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
        accessorKey: "code",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Code" />
        ),
        cell: ({ row }) => <span className="font-mono font-medium">{row.getValue("code")}</span>,
    },
    {
        accessorKey: "email",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Email" />
        ),
        cell: ({ row }) => {
            const email = row.getValue("email") as string | null;
            return (
                <div className="flex items-center gap-2">
                    {email ? (
                        <>
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span>{email}</span>
                        </>
                    ) : (
                        <span className="text-muted-foreground italic text-xs">Batch / Any</span>
                    )}
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
        accessorKey: "uses",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Uses" />
        ),
        cell: ({ row }) => {
            const uses = row.original.uses;
            const max = row.original.maxUses;
            return (
                <div className="flex items-center gap-1 text-sm">
                    <span className={uses >= max ? "text-destructive font-medium" : ""}>{uses}</span>
                    <span className="text-muted-foreground">/</span>
                    <span>{max}</span>
                </div>
            )
        }
    },
    {
        accessorKey: "createdAt",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Created At" />
        ),
        cell: ({ row }) => (
            <div className="lowercase text-muted-foreground">
                {row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString() : "N/A"}
            </div>
        ),
    },
    {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => {
            const invite = row.original;
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
                            onClick={() => navigator.clipboard.writeText(invite.code)}
                        >
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Code
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => onDelete(invite.id)}>
                            <Trash className="mr-2 h-4 w-4" />
                            Revoke Invite
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];

// Sample role options (customize as needed)
const roleOptions = [
    { value: "tester", label: "Tester" },
    { value: "user", label: "User" },
    { value: "admin", label: "Admin" },
];

const RoleOptionComponent: React.FC<{
    value: string;
    label: string;
    isSelected: boolean;
    onToggle: (value: string) => void;
    disabled?: boolean;
}> = ({ label, value, isSelected, onToggle, disabled }) => (
    <Button
        type="button"
        variant={isSelected ? "default" : "outline"}
        onClick={() => onToggle(value)}
        className="h-8"
        disabled={disabled}
        size="sm"
    >
        {label}
    </Button>
);

const config: FormFieldConfig[] = [
    {
        name: "email",
        type: "text",
        label: "Recipient Email",
        placeholder: "Enter email address",
        description: "Email to send the invitation to (single).",
    },
    {
        name: "role",
        type: "choice",
        label: "Assigned Role",
        mode: "single",
        options: roleOptions,
        optionComponent: RoleOptionComponent,
        className: 'flex gap-2'
    },
    {
        name: "maxUses",
        type: "number",
        label: "Max Number of Uses",
        placeholder: "e.g., 1",
        description: "How many times this code can be redeemed.",
    },
    {
        name: "emailListFile",
        type: "file",
        label: "Upload Email List (Optional)",
        description: "Upload a CSV or text file with a list of emails for batch invitations.",
        accept: ".csv,.txt",
    },
];

export const InvitationPage: React.FC = () => {
    const { invites, isLoading, sendInvites, isSending, error, deleteInvite, deleteInvites } = useInvites();
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);

    const form = useForm<InvitationFormValues>({
        mode: "onSubmit",
        reValidateMode: "onSubmit",
        defaultValues: {
            email: "",
            role: "user",
            maxUses: 1,
            emailListFile: null,
        },
    });

    const columns = React.useMemo(() => getColumns(deleteInvite), [deleteInvite]);

    const onSubmit = (data: InvitationFormValues) => {
        // Prepare form data for backend (e.g., multipart if file present)
        const formData = new FormData();
        formData.append("email", data.email);
        formData.append("role", data.role);
        formData.append("maxUses", data.maxUses.toString());
        if (data.emailListFile) {
            formData.append("emailListFile", data.emailListFile);
        }

        // Trigger mutation
        sendInvites(formData, {
            onSuccess: () => {
                form.reset();
                setIsDialogOpen(false);
            },
        });
    };

    const actions = [
        {
            label: "Export",
            icon: <File className="h-4 w-4" />,
            variant: "outline" as const,
            onClick: () => {
                // Handle export
            },
        },
        {
            label: "Send Invitation",
            icon: <PlusCircle className="h-4 w-4" />,
            onClick: () => setIsDialogOpen(true),
        },
    ];

    return (
        <AdminPage title="Invitations" description="Manage and send invitation codes to users." pageActions={actions}>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Send Invitation</DialogTitle>
                        <DialogDescription>
                            Create a new invitation code for a user or tester.
                        </DialogDescription>
                    </DialogHeader>
                    <DynamicForm
                        form={form}
                        config={config}
                        onSubmit={onSubmit}
                        submitText={isSending ? "Sending..." : "Send Invitations"}
                        orientation="vertical"
                        className="space-y-4"
                    />
                    {error ? (
                        <p className="text-destructive text-sm mt-2">
                            Error: {error instanceof Error ? error.message : String(error)}
                        </p>
                    ) : null}
                </DialogContent>
            </Dialog>

            <Tabs defaultValue="all">
                <div className="flex items-center">
                    <TabsList>
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="tester">Testers</TabsTrigger>
                        <TabsTrigger value="user">Users</TabsTrigger>
                        <TabsTrigger value="admin">Admins</TabsTrigger>
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
                                <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuCheckboxItem checked>
                                    Active
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem>
                                    Revoked
                                </DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
                {["all", "tester", "user", "admin"].map((tab) => (
                    <TabsContent key={tab} value={tab}>
                        <Card>
                            <CardContent className="py-0 px-2">
                                <DataTable
                                    columns={columns}
                                    data={tab === "all" ? invites : invites.filter(item => item.role === tab)}
                                    searchColumn="email"
                                    actions={(table) => (
                                        <DataTableActions
                                            table={table}
                                            onDelete={(rows) => {
                                                const ids = rows.map((r) => r.id);
                                                deleteInvites(ids, { onSuccess: () => table.resetRowSelection() });
                                            }}
                                        />
                                    )}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>
                ))}
            </Tabs>
        </AdminPage>
    );
};