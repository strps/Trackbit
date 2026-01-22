import { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Trash } from "lucide-react";

interface DataTableActionsProps<TData> {
    table: Table<TData>;
    onDelete: (rows: TData[]) => void;
}

export function DataTableActions<TData>({
    table,
    onDelete,
}: DataTableActionsProps<TData>) {
    const selectedRows = table.getFilteredSelectedRowModel().rows;

    if (selectedRows.length === 0) return null;

    return (
        <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(selectedRows.map((row) => row.original))}
        >
            <Trash className="mr-2 h-4 w-4" />
            Delete ({selectedRows.length})
        </Button>
    );
}