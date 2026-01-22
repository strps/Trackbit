import { cn } from "@/lib/utils";
import { LucideIcon, PlusCircle } from "lucide-react";

interface EmptyCreateNewProps {
    title?: string;
    description?: string;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
    className?: string;
    textPosition?: "top" | "bottom" | "left" | "right";
    icon?: LucideIcon;
}



/**
 * A reusable UI component that displays an empty state placeholder when no data is present.
 * It serves as an actionable call-to-action, allowing users to initiate the creation of new content
 * by clicking anywhere on the component. This pattern is commonly known as an "Empty State" or
 * "Blank State" in user interface design.
 *
 * <p>The component renders a centered plus icon within a circular container, followed by a title
 * and description. The entire area is styled with a dashed border and subtle background to
 * visually indicate an empty section while remaining interactive.</p>
 *
 * <p>Typical use cases include:</p>
 * A reusable UI component that displays an empty state placeholder when no data is present.
 * It serves as an actionable call-to-action, allowing users to initiate the creation of new content
 * by clicking anywhere on the component. This pattern is commonly known as an "Empty State" or
 * "Blank State" in user interface design.
 *
 * <p>The component renders a centered plus icon within a circular container, followed by a title
 * and description. The entire area is styled with a dashed border and subtle background to
 * visually indicate an empty section while remaining interactive.</p>
 *
 * <p>Typical use cases include:</p>
 * <ul>
 *   <li>Displaying a placeholder in lists, tables, or cards when no items exist yet</li>
 *   <li>Onboarding screens for new features (e.g., "No workouts logged yet")</li>
 *   <li>Search results or filtered views with zero matches</li>
 * </ul>
 *
 * <p>The component is implemented in React with TypeScript and utilizes Tailwind CSS for styling
 * along with the Lucide React icon library.</p>
 *
 * @param onClick   Callback function invoked when the component is clicked. This should typically
 *                  trigger the creation flow (e.g., opening a modal, starting a new session, etc.).
 * @param title     The primary heading text displayed in the empty state. Should be concise and
 *                  descriptive (e.g., "No sessions yet").
 * @param description Secondary explanatory text providing additional context or guidance
 *                    (e.g., "Click here to create your first workout session").
 *
 * @example
 * // Conditional rendering example
 * {sessions.length === 0 ? (
 *   <EmptyState
 *     onClick={() => createNewSession()}
 *     title="No workout sessions"
 *     description="Start tracking your progress by creating your first session"
 *   />
 * ) : (
 *   <SessionList sessions={sessions} />
 * )}
 *
 * @since 1.0.0
 */
export const EmptyState = ({ onClick, title, description, className, textPosition = "bottom", icon: Icon }: EmptyCreateNewProps) => {

    const textAling =
        (textPosition === "left") ? "left" :
            (textPosition === "right") ? "right" : "center";

    const flexDirection =
        (textPosition === "top") ? "flex-col-reverse" :
            (textPosition === "bottom") ? "flex-col" :
                (textPosition === "left") ? "flex-row-reverse" :
                    "flex-row";

    const iconClassName = "w-10 h-10 text-muted-foreground"
    return (
        <div
            onClick={onClick}
            className={cn(onClick ? "cursor-pointer" : "", flexDirection, EmptyStateClassName, className)}>
            {Icon ? <Icon className={iconClassName} /> : <PlusCircle className={iconClassName} />}

            <div className={`text-${textAling}`}>
                <h4 className="font-medium text-foreground">{title}</h4>
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </div>
        </div>
    );
}

export const EmptyStateClassName = "flex flex-col p-8 items-center justify-center border-4 border-dashed border-border rounded-xl bg-muted/50";