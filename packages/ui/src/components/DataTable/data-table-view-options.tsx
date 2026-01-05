import { Column, Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

interface DataTableViewOptionsProps<TData> {
    table: Table<TData>;
}

export function DataTableViewOptions<TData>({ table }: DataTableViewOptionsProps<TData>) {


    return (
        <DropdownMenu>
            <DropdownMenuTrigger >
                <Button variant="outline" size="sm">
                    Columns <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {
                    Object.keys(table.getAllColumns()).
                        filter((key: keyof Column<TData, any>) => table[key]!.getCanHide()
                        )
                        .map((key: keyof Table<TData>) => {
                            const column = table[key];
                            return (
                                <>
                                    <DropdownMenuCheckboxItem
                                        key={key}
                                        className="capitalize"
                                        checked={column.getIsVisible()}
                                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                                    >
                                    </DropdownMenuCheckboxItem>
                                    {column.id}
                                </>
                            )
                        })
                }
            </DropdownMenuContent>
        </DropdownMenu>
    );
}