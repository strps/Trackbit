import { cn } from "@/lib/utils";
import React from "react";

interface BigButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    className?: string;
    selectedClassName?: string;
    isSelected: boolean;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    // Remove the old `props?: ...` — we're now properly extending button attributes
}

export const bigButtonClassName = "p-4 rounded-xl border-2 text-left transition-all flex gap-4 items-start"
export const bigButtonSelectedClassName = "bg-primary/5 ring-2 ring-primary shadow-lg"

export const BigButton = React.forwardRef<HTMLButtonElement, BigButtonProps>(({
    children,
    className,
    isSelected,
    selectedClassName,
    onClick,
    type = "button",
    ...props
}: BigButtonProps, ref) => {

    const buttonSelectedClassName = isSelected ? cn(bigButtonSelectedClassName, selectedClassName) : ""
    const buttonClassName = cn(bigButtonClassName, className, buttonSelectedClassName)

    return (
        <button
            ref={ref}
            type={type}
            className={buttonClassName} {...props}
            onClick={onClick}
            {...props}
        >
            {children}
        </button>
    )
})