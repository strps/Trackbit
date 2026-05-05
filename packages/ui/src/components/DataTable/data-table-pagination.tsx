import { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DataTablePaginationProps<TData> {
    table: Table<TData>;
    previous?: string;
    next?: string;
    rowsSelected?: (selected: number, total: number) => string;
}

export function DataTablePagination<TData>({
    table,
    previous = "Previous",
    next = "Next",
    rowsSelected = (s, t) => `${s} of ${t} row(s) selected.`,
}: DataTablePaginationProps<TData>) {
    return (
        <div className="flex items-center justify-between px-2">
            <div className="flex-1 text-sm text-muted-foreground">
                {rowsSelected(
                    table.getFilteredSelectedRowModel().rows.length,
                    table.getFilteredRowModel().rows.length,
                )}
            </div>
            <div className="flex items-center space-x-6 lg:space-x-8">
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        {previous}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        {next}
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}