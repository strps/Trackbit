import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Bug, MessageSquare } from "lucide-react";
import {
    Button,
    Checkbox,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DataTable,
    DataTableColumnHeader,
    Card,
    CardContent,
    Badge,
} from "@trackbit/ui";

import { AdminIssue } from "../use-admin-issues";

const TYPE_CONFIG: Record<AdminIssue["type"], { label: string; icon: React.ReactNode; className: string }> = {
    bug: { label: "Bug", icon: <Bug className="h-3 w-3" />, className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    feedback: { label: "Feedback", icon: <MessageSquare className="h-3 w-3" />, className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
};

const STATUS_CONFIG: Record<AdminIssue["status"], { label: string; className: string }> = {
    open: { label: "Open", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    resolved: { label: "Resolved", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    closed: { label: "Closed", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

const STATUS_TRANSITIONS: Record<AdminIssue["status"], AdminIssue["status"][]> = {
    open: ["resolved", "closed"],
    resolved: ["open", "closed"],
    closed: ["open"],
};

function buildColumns(
    onStatusChange: (id: number, status: AdminIssue["status"]) => void
): ColumnDef<AdminIssue>[] {
    return [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() && "indeterminate")
                    }
                    onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(v) => row.toggleSelected(!!v)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: "type",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
            cell: ({ row }) => {
                const config = TYPE_CONFIG[row.getValue<AdminIssue["type"]>("type")];
                return (
                    <Badge variant="secondary" className={`flex items-center gap-1 w-fit ${config.className}`}>
                        {config.icon}
                        {config.label}
                    </Badge>
                );
            },
        },
        {
            accessorKey: "title",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Title / Path" />,
            cell: ({ row }) => {
                const issue = row.original;
                return (
                    <div className="grid gap-0.5 max-w-64">
                        <span className="font-medium truncate">
                            {issue.title ?? <span className="text-muted-foreground italic">No title</span>}
                        </span>
                        {issue.path && (
                            <span className="text-xs text-muted-foreground font-mono truncate">{issue.path}</span>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: "userEmail",
            header: ({ column }) => <DataTableColumnHeader column={column} title="User" />,
            cell: ({ row }) => {
                const issue = row.original;
                return (
                    <div className="grid gap-0.5">
                        {issue.userName && <span className="text-sm font-medium">{issue.userName}</span>}
                        <span className="text-xs text-muted-foreground">{issue.userEmail ?? "—"}</span>
                    </div>
                );
            },
        },
        {
            accessorKey: "status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
            cell: ({ row }) => {
                const config = STATUS_CONFIG[row.getValue<AdminIssue["status"]>("status")];
                return (
                    <Badge variant="secondary" className={config.className}>
                        {config.label}
                    </Badge>
                );
            },
        },
        {
            accessorKey: "createdAt",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Reported" />,
            cell: ({ row }) => {
                const val = row.getValue<string | null>("createdAt");
                return (
                    <span className="text-sm text-muted-foreground">
                        {val ? new Date(val).toLocaleDateString() : "—"}
                    </span>
                );
            },
        },
        {
            id: "actions",
            enableHiding: false,
            cell: ({ row }) => {
                const issue = row.original;
                const transitions = STATUS_TRANSITIONS[issue.status];
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
                            <DropdownMenuSeparator />
                            {transitions.map((next) => (
                                <DropdownMenuItem
                                    key={next}
                                    onClick={() => onStatusChange(issue.id, next)}
                                >
                                    Mark as {STATUS_CONFIG[next].label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];
}

interface IssueTableProps {
    data: AdminIssue[];
    onStatusChange: (id: number, status: AdminIssue["status"]) => void;
}

export function IssueTable({ data, onStatusChange }: IssueTableProps) {
    const columns = React.useMemo(
        () => buildColumns(onStatusChange),
        [onStatusChange]
    );
    return (
        <Card>
            <CardContent className="py-0 px-2">
                <DataTable columns={columns} data={data} searchColumn="userEmail" />
            </CardContent>
        </Card>
    );
}
