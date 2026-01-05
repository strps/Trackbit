import { Table } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "./data-table-view-options";

interface DataTableToolbarProps<TData> {
    table: Table<TData>;
    searchColumn?: string;
}

export function DataTableToolbar<TData>({ table, searchColumn }: DataTableToolbarProps<TData>) {
    const searchKey = searchColumn ?? "global";

    return (
        <div className="flex items-center justify-between">
            <div className="flex flex-1 items-center space-x-2">
                {searchColumn && (
                    <Input
                        placeholder={`Filter ${searchColumn}...`}
                        value={(table.getColumn(searchColumn)?.getFilterValue() as string) ?? ""}
                        onChange={(event) => table.getColumn(searchColumn)?.setFilterValue(event.target.value)}
                        className="h-9 w-[150px] lg:w-[300px]"
                    />
                )}
            </div>
            <DataTableViewOptions table={table} />
        </div>
    );
}