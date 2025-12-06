import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils"; // Assuming you have this standard shadcn utility

interface CollapsibleSectionProps {
    title?: string;
    /** Optional content to show in the header (like your color preview circles) */
    headerContent?: React.ReactNode;
    children: React.ReactNode;
    isOpen?: boolean;
    className?: string;
}

export function CollapsibleSection({
    title,
    headerContent,
    children,
    isOpen = false,
    className
}: CollapsibleSectionProps) {

    const buttonSelectedClassName = isOpen ? cn("ring-2 ring-ring shadow-lg") : ""
    const buttonClassName = cn("p-4 rounded-xl border-2 text-left transition-all flex gap-4 items-start", className, buttonSelectedClassName)


    return (
        <div className={cn("border  rounded-md overflow-hidden transition-all", className)}>

            {/* Header / Trigger */}
            <div
                className="relative flex w-full items-center justify-between cursor-pointer transition-colors select-none"
            >
                <div className="flex items-center gap-4 overflow-hidden w-full">
                    {title && <span className="font-bold text-sm text-slate-700 dark:text-slate-200 shrink-0">
                        {title}
                    </span>}
                    {headerContent && (
                        <div className="flex items-center animate-in fade-in slide-in-from-left-2 duration-300 w-full">
                            {headerContent}
                        </div>
                    )}
                </div>

                <ChevronDown
                    className={cn(
                        "w-5 h-5 text-muted-foreground absolute top-1/2 right-8 -translate-y-1/2 transition-transform duration-200",
                        isOpen && "rotate-180"
                    )}
                />
            </div>

            {/* Expandable Content */}
            <div
                className={cn(
                    "grid transition-all duration-300 ease-in-out",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                )}
            >
                <div className="overflow-hidden">
                    <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-800/50">
                        <div className="pt-4">
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}