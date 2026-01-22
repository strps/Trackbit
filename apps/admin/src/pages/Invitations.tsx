// pages/Invite.tsx (updated frontend component with hook and DataTable integration)

import React from "react";
import { useForm } from "react-hook-form";
import { DynamicForm, FormFieldConfig, Button, AdminPage } from "@trackbit/ui";  // Adjust path as needed
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@trackbit/ui";  // Adjust path to match your DataTable export
import { DataTableColumnHeader } from "@trackbit/ui";  // Adjust path accordingly

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
            const res = await fetch(`${import.meta.env.VITE_API_URL}/invitations`, {
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
            const res = await fetch(`${import.meta.env.VITE_API_URL}/invitations`, {
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

    return {
        invites,
        isLoading,
        sendInvites: mutation.mutate,
        isSending: mutation.isPending,
        error: mutation.error,
    };
}

// Sample role options (customize as needed)
const roleOptions = [
    { value: "user", label: "User" },
    { value: "admin", label: "Admin" },
    { value: "guest", label: "Guest" },
];

// Custom option component for choices (simple button-like for illustration)
const RoleOptionComponent: React.FC<{
    value: string;
    label: string;
    isSelected: boolean;
    onToggle: (value: string) => void;
    disabled?: boolean;
}> = ({ label, isSelected, onToggle, disabled }) => (
    <Button
        type="button"
        onClick={() => onToggle(label)}  // Toggle based on label or value as needed
        className={`p-2 border ${isSelected ? "bg-blue-500 text-white" : "bg-white"}`}
        disabled={disabled}
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

// Define columns for DataTable
const inviteColumns: ColumnDef<Invite>[] = [
    {
        accessorKey: "code",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
    },
    {
        accessorKey: "email",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
    },
    {
        accessorKey: "role",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
    },
    {
        accessorKey: "maxUses",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Max Uses" />,
    },
    {
        accessorKey: "uses",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Uses" />,
    },
    {
        accessorKey: "createdAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Created At" />,
        cell: ({ row }) => row.original.createdAt ? new Date(row.original.createdAt).toLocaleString() : "N/A",
    },
    // Add more columns as needed (e.g., expiresAt)
];

export const InvitationPage: React.FC = () => {
    const { invites, isLoading, sendInvites, isSending, error } = useInvites();

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
                form.reset();  // Reset form on success
            },
        });
    };

    return (
        <AdminPage title="Invitations" description="Manage and send invitation codes to users.">
            <DynamicForm
                form={form}
                config={config}
                onSubmit={onSubmit}
                submitText="Send Invitations"
                orientation="vertical"
            />
            {error ? (
                <p className="text-red-500 mt-2">
                    Error: {error instanceof Error ? error.message : String(error)}
                </p>
            ) : null}

            <h2 className="text-xl font-bold mt-8 mb-4">Existing Invites</h2>
            {isLoading ? (
                <p>Loading invites...</p>
            ) : (
                <DataTable
                    columns={inviteColumns}
                    data={invites}
                    searchColumn="email"
                />
            )}
        </AdminPage>
    );
};