import { ReactNode } from "react";
import { AlertCircle, Construction } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils/utils"; // Assuming you have Shadcn's cn utility for class merging

interface UnderConstructionProps {
    /**
     * The main title for the under construction message.
     * @default "Under Construction"
     */
    title?: string;

    /**
     * A descriptive message explaining the status.
     * @default "This section is currently being built. Please check back soon."
     */
    description?: string;

    /**
     * Custom icon to display. Defaults to Lucide's Construction icon.
     */
    icon?: ReactNode;

    /**
     * Whether to render as a full-page placeholder (takes full viewport height).
     * @default false
     */
    isFullPage?: boolean;

    /**
     * Optional action button text (e.g., "Go Back").
     */
    buttonText?: string;

    /**
     * Optional onClick handler for the action button.
     */
    onButtonClick?: () => void;

    /**
     * Additional content to render below the description.
     */
    children?: ReactNode;

    /**
     * Custom className for the outer container.
     */
    className?: string;
}

export function UnderConstruction({
    title = "Under Construction",
    description = "This section is currently being built. Please check back soon.",
    icon,
    isFullPage = false,
    buttonText,
    onButtonClick,
    children,
    className,
}: UnderConstructionProps) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center p-6 text-center",
                isFullPage ? "min-h-screen bg-background" : "min-h-[200px]",
                className
            )}
        >
            <Alert variant="default" className="max-w-md w-full">
                <div className="flex justify-center mb-4">
                    {icon ? icon : <Construction className="h-12 w-12 text-muted-foreground" />}
                </div>
                <AlertTitle className="text-xl font-bold mb-2">{title}</AlertTitle>
                <AlertDescription className="text-muted-foreground mb-4">
                    {description}
                </AlertDescription>
                {children && <div className="mt-4">{children}</div>}
                {buttonText && onButtonClick && (
                    <Button variant="outline" onClick={onButtonClick} className="mt-4">
                        {buttonText}
                    </Button>
                )}
            </Alert>
        </div>
    );
}