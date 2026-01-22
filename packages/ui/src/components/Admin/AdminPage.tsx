import { PlusCircle, File } from "lucide-react";
import { Button } from "../ui/button";
import { buttonVariants } from "../ui/button";

interface AdminPageProps {
    title: string;
    description: string;
    children: React.ReactNode;
    pageActions?: {
        label: string;
        icon?: React.ReactNode;
        onClick?: () => void;
        variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
    }[]
}

export const AdminPage = (
    {
        title,
        description,
        children,
        pageActions
    }: AdminPageProps
) => {
    return (
        <div className="flex flex-col gap-4 p-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
                    <p className="text-muted-foreground">
                        {description}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {
                        pageActions && pageActions.map((action) => (
                            <Button
                                variant={action.variant || "default"}
                                onClick={action.onClick}
                                className="gap-1"
                            >
                                {action.icon}
                                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                    {action.label}
                                </span>
                            </Button>
                        ))
                    }

                </div>
            </header>
            {children}
        </div>
    );
}