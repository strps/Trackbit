import { cn } from "@/shared/utils/utils";
import { motion } from "motion/react";

// Variant objects defined at module scope so their references are stable
// across renders — prevents React from unmounting/remounting motion components
// (which would re-trigger the initial→animate entrance animation).
const parentVariants = {
    initial: { opacity: 0, y: -5 },
    animate: { opacity: 1, y: 0 },
    hover: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -5 },
};
const iconVariants = {
    initial: { scale: 0.8 },
    hover: { scale: 1 },
};
const textVariants = {
    initial: { opacity: 0, width: 0, marginLeft: 0 },
    hover: { opacity: 1, width: "auto", marginLeft: "0.25rem" },
};

// Sub-components hoisted to module scope so React never sees a new component
// type on re-render, which would otherwise unmount and remount the element.
export const BadgeParent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <motion.div
        className={cn("flex justify-center items-center p-0.5 rounded text-[9px] font-black uppercase tracking-wider shadow", className)}
        variants={parentVariants}
        initial="initial"
        animate="animate"
        whileHover="hover"
        exit="exit"
    >
        {children}
    </motion.div>
);

export const BadgeIcon = ({ children }: { children: React.ReactNode }) => (
    <motion.div className="flex justify-center items-center" variants={iconVariants}>
        {children}
    </motion.div>
);

export const BadgeText = ({ children }: { children: React.ReactNode }) => (
    <motion.span variants={textVariants} className="text-nowrap">
        {children}
    </motion.span>
);
