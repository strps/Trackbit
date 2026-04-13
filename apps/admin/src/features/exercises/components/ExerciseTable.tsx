import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
    MoreHorizontal,
    Dumbbell,
    Pencil,
    Trash2,
} from "lucide-react";
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

import { getCategoryConfig } from "../category-config";
import { AdminExercise } from "../use-admin-exercises";

function buildExerciseColumns(
    onEdit: (ex: AdminExercise) => void,
    onDelete: (ex: AdminExercise) => void
): ColumnDef<AdminExercise>[] {
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
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
            cell: ({ row }) => {
                const ex = row.original;
                return (
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-muted">
                            <Dumbbell className="h-4 w-4 text-foreground" />
                        </div>
                        <div className="grid gap-0.5">
                            <span className="font-medium">{ex.name}</span>
                            {ex.description && (
                                <span className="text-xs text-muted-foreground truncate max-w-48">
                                    {ex.description}
                                </span>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            accessorKey: "category",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
            cell: ({ row }) => {
                const config = getCategoryConfig(row.getValue("category"));
                return (
                    <Badge variant="secondary" className={config.color}>
                        {config.label}
                    </Badge>
                );
            },
        },
        {
            id: "muscleGroups",
            header: "Muscle Groups",
            cell: ({ row }) => {
                const groups = row.original.muscleGroups;
                if (!groups.length)
                    return <span className="text-muted-foreground text-xs">—</span>;
                return (
                    <div className="flex flex-wrap gap-1">
                        {groups.slice(0, 3).map((mg) => (
                            <Badge key={mg.id} variant="outline" className="text-xs">
                                {mg.name}
                            </Badge>
                        ))}
                        {groups.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                                +{groups.length - 3}
                            </Badge>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: "createdAt",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
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
                const ex = row.original;
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
                            <DropdownMenuItem onClick={() => onEdit(ex)}>
                                <Pencil className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => onDelete(ex)}
                            >
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];
}

interface ExerciseTableProps {
    data: AdminExercise[];
    onEdit: (ex: AdminExercise) => void;
    onDelete: (ex: AdminExercise) => void;
}

export function ExerciseTable({ data, onEdit, onDelete }: ExerciseTableProps) {
    const columns = React.useMemo(
        () => buildExerciseColumns(onEdit, onDelete),
        [onEdit, onDelete]
    );
    return (
        <Card>
            <CardContent className="py-0 px-2">
                <DataTable columns={columns} data={data} searchColumn="name" />
            </CardContent>
        </Card>
    );
}
