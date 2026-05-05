import { Table } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "./data-table-view-options";

interface DataTableToolbarProps<TData> {
    table: Table<TData>;
    searchColumn?: string;
    children?: React.ReactNode;
    filterPlaceholder?: (column: string) => string;
    columns?: string;
    toggleColumns?: string;
}

export function DataTableToolbar<TData>({
    table,
    searchColumn,
    children,
    filterPlaceholder = (col) => `Filter ${col}...`,
    columns,
    toggleColumns,
}: DataTableToolbarProps<TData>) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex flex-1 items-center space-x-2">
                {searchColumn && (
                    <Input
                        placeholder={filterPlaceholder(searchColumn)}
                        value={(table.getColumn(searchColumn)?.getFilterValue() as string) ?? ""}
                        onChange={(event) => table.getColumn(searchColumn)?.setFilterValue(event.target.value)}
                        className="h-9 w-[150px] lg:w-[300px]"
                    />
                )}
                {children}
            </div>
            <DataTableViewOptions table={table} columns={columns} toggleColumns={toggleColumns} />
        </div>
    );
}