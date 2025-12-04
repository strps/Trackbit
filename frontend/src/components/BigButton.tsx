import { cn } from "@/lib/utils";
import React from "react";

interface BigButtonProps {
    children: React.ReactNode;
    className?: string;
    selectedClassName?: string;
    isSelected: boolean;
    onClick?: () => void;
    props?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}


export const BigButton = ({
    children,
    className,
    isSelected,
    selectedClassName,
    ...props
}: BigButtonProps) => {

    const buttonSelectedClassName = isSelected ? cn("ring-2 ring-ring shadow-lg", selectedClassName) : ""
    const buttonClassName = cn("p-4 rounded-xl border-2 text-left transition-all flex gap-4 items-start", className, buttonSelectedClassName)

    return (
        <button className={buttonClassName} {...props} onClick={props.onClick}>
            {children}
        </button>
    )
}