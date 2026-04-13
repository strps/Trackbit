import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
    MoreHorizontal,
    Layers,
    Pencil,
    Trash2,
} from "lucide-react";
import {
    Button,
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

import { MuscleGroup } from "../use-admin-exercises";

function buildMGColumns(
    onEdit: (mg: MuscleGroup) => void,
    onDelete: (mg: MuscleGroup) => void
): ColumnDef<MuscleGroup>[] {
    return [
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
            cell: ({ row }) => {
                const mg = row.original;
                return (
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-muted">
                            <Layers className="h-4 w-4 text-foreground" />
                        </div>
                        <span className="font-medium">{mg.name}</span>
                    </div>
                );
            },
        },
        {
            accessorKey: "parentName",
            header: "Parent",
            cell: ({ row }) => {
                const parent = row.getValue<string | null>("parentName");
                return parent ? (
                    <Badge variant="secondary">{parent}</Badge>
                ) : (
                    <span className="text-muted-foreground text-xs">Top-level</span>
                );
            },
        },
        {
            accessorKey: "level",
            header: "Level",
            cell: ({ row }) => (
                <Badge variant="outline">Level {row.getValue("level")}</Badge>
            ),
        },
        {
            accessorKey: "slug",
            header: "Slug",
            cell: ({ row }) => (
                <span className="text-xs font-mono text-muted-foreground">
                    {row.getValue("slug")}
                </span>
            ),
        },
        {
            accessorKey: "description",
            header: "Description",
            cell: ({ row }) => {
                const desc = row.getValue<string | null>("description");
                return desc ? (
                    <span className="text-sm text-muted-foreground truncate max-w-48 block">
                        {desc}
                    </span>
                ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                );
            },
        },
        {
            id: "actions",
            enableHiding: false,
            cell: ({ row }) => {
                const mg = row.original;
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
                            <DropdownMenuItem onClick={() => onEdit(mg)}>
                                <Pencil className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => onDelete(mg)}
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

interface MGTableProps {
    data: MuscleGroup[];
    onEdit: (mg: MuscleGroup) => void;
    onDelete: (mg: MuscleGroup) => void;
}

export function MuscleGroupTable({ data, onEdit, onDelete }: MGTableProps) {
    const columns = React.useMemo(() => buildMGColumns(onEdit, onDelete), [onEdit, onDelete]);
    return (
        <Card>
            <CardContent className="py-0 px-2">
                <DataTable columns={columns} data={data} searchColumn="name" />
            </CardContent>
        </Card>
    );
}
