import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
    MoreHorizontal,
    PlusCircle,
    File,
    ListFilter,
    Dumbbell,
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
    Card,
    CardContent,
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    Badge,
    AdminPage,
} from "@trackbit/ui";

// Mock data based on the exercises schema
const exercises = [
    {
        id: 1,
        name: "Bench Press",
        category: "strength",
        description: "Compound exercise for chest, shoulders, and triceps.",
        defaultWeightUnit: "kg",
        defaultDistanceUnit: null,
        createdAt: "2023-01-15T10:30:00Z",
        userId: null, // System default
    },
    {
        id: 2,
        name: "Running",
        category: "cardio",
        description: "Outdoor or treadmill running.",
        defaultWeightUnit: null,
        defaultDistanceUnit: "km",
        createdAt: "2023-02-20T14:00:00Z",
        userId: null,
    },
    {
        id: 3,
        name: "Squat",
        category: "strength",
        description: "Compound lower body exercise.",
        defaultWeightUnit: "kg",
        defaultDistanceUnit: null,
        createdAt: "2023-03-10T09:00:00Z",
        userId: null,
    },
    {
        id: 4,
        name: "Yoga Flow",
        category: "flexibility",
        description: "Vinyasa flow sequence.",
        defaultWeightUnit: null,
        defaultDistanceUnit: null,
        createdAt: "2023-04-05T18:45:00Z",
        userId: "user123", // Custom user exercise
    },
    {
        id: 5,
        name: "Deadlift",
        category: "strength",
        description: "Full body compound movement.",
        defaultWeightUnit: "kg",
        defaultDistanceUnit: null,
        createdAt: "2023-05-22T11:20:00Z",
        userId: null,
    },
];

export type Exercise = typeof exercises[number];

const getCategoryBadgeVariant = (category: string) => {
    switch (category) {
        case "strength":
            return "default";
        case "cardio":
            return "secondary";
        case "flexibility":
            return "outline";
        default:
            return "secondary";
    }
};

export const columns: ColumnDef<Exercise>[] = [
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
        accessorKey: "name",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => {
            const exercise = row.original;
            return (
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-muted">
                        <Dumbbell className="h-4 w-4 text-foreground" />
                    </div>
                    <div className="grid gap-0.5">
                        <span className="font-medium">{exercise.name}</span>
                        {exercise.description && (
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {exercise.description}
                            </span>
                        )}
                    </div>
                </div>
            );
        },
    },
    {
        accessorKey: "category",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Category" />
        ),
        cell: ({ row }) => (
            <Badge variant={getCategoryBadgeVariant(row.getValue("category"))} className="capitalize">
                {row.getValue("category")}
            </Badge>
        ),
    },
    {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => {
            const isSystem = row.original.userId === null;
            return (
                <Badge variant={isSystem ? "secondary" : "outline"}>
                    {isSystem ? "System" : "Custom"}
                </Badge>
            );
        }
    },
    {
        accessorKey: "createdAt",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Created At" />
        ),
        cell: ({ row }) => (
            <div className="lowercase">
                {new Date(row.getValue("createdAt")).toLocaleDateString()}
            </div>
        ),
    },
    {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => {
            const exercise = row.original;
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
                            onClick={() => navigator.clipboard.writeText(exercise.id.toString())}
                        >
                            Copy ID
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Edit exercise</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Delete exercise</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];

export default function ExercisesPage() {
    const [data] = React.useState(() => [...exercises]);

    const actions = [
        {
            label: "Export",
            icon: <File className="h-4 w-4" />,
            variant: "outline" as const,
            onClick: () => {
                // Handle export action
            },
        },
        {
            label: "Add Exercise",
            icon: <PlusCircle className="h-4 w-4" />,
            onClick: () => {
                // Handle add exercise action
            },
        },

    ];

    return (
        <AdminPage title="Exercises" description="Manage system and user exercises." pageActions={actions}>
            {/* <div className="flex flex-col gap-4">
                <header className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Exercises</h1>
                        <p className="text-muted-foreground">
                            Manage system and user exercises.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="gap-1">
                            <File className="h-3.5 w-3.5" />
                            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                Export
                            </span>
                        </Button>
                        <Button size="sm" className="gap-1">
                            <PlusCircle className="h-3.5 w-3.5" />
                            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                Add Exercise
                            </span>
                        </Button>
                    </div>
                </header> */}

            <Tabs defaultValue="all">
                <div className="flex items-center">
                    <TabsList>
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="strength">Strength</TabsTrigger>
                        <TabsTrigger value="cardio">Cardio</TabsTrigger>
                        <TabsTrigger value="flexibility">Flexibility</TabsTrigger>
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
                                <DropdownMenuLabel>Filter by Type</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuCheckboxItem checked>
                                    System Default
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem>
                                    User Custom
                                </DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
                {["all", "strength", "cardio", "flexibility"].map((tab) => (
                    <TabsContent key={tab} value={tab}>
                        <Card>
                            <CardContent className="py-0 px-2">
                                <DataTable
                                    columns={columns}
                                    data={tab === "all" ? data : data.filter(item => item.category === tab)}
                                    searchColumn="name"
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>
                ))}
            </Tabs>
        </AdminPage>
    );
}