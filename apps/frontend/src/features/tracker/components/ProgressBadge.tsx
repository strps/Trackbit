
// -------------------------------------------------------------------
// Tiered progress badge: Bronze → Silver → Gold

import { cn } from "@/shared/utils/utils";
import { ShieldAlert, Trophy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

// Variant objects defined at module scope so their references are stable
// across renders — prevents React from unmounting/remounting motion components
// (which would re-trigger the initial→animate entrance animation).
const parentVariants = {
    initial: { opacity: 0, y: -5 },
    animate: { opacity: 1, y: 0 },
    hover: { opacity: 1, y: 0, scale: 1.5 },
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
const Parent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <motion.div
        className={cn(`flex justify-center items-center p-0.5 rounded text-[9px] font-black uppercase tracking-wider shadow`, className)}
        variants={parentVariants}
        initial="initial"
        animate="animate"
        whileHover="hover"
        exit="exit"
    >
        {children}
    </motion.div>
);

const IconWrapper = ({ children }: { children: React.ReactNode }) => (
    <motion.div
        className="flex justify-center items-center"
        variants={iconVariants}
    >
        {children}
    </motion.div>
);

const TextWrapper = ({ children }: { children: React.ReactNode }) => (
    <motion.span variants={textVariants}>
        {children}
    </motion.span>
);

// -------------------------------------------------------------------
export const ProgressBadge = ({ progress, isAntiHabit }: { progress: number; isAntiHabit?: boolean }) => {
    const Badge = isAntiHabit
        ? (
            progress <= 0
                ? (
                    <Parent className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400">
                        <IconWrapper>
                            <ShieldAlert size={'1rem'} />
                        </IconWrapper>
                        <TextWrapper>Avoided</TextWrapper>
                    </Parent>
                )
                : (
                    <Parent className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-400">
                        <IconWrapper>
                            <ShieldAlert size={'1rem'} />
                        </IconWrapper>
                        <TextWrapper>Slipped</TextWrapper>
                    </Parent>
                )
        )
        : (
            progress <= 0
                ? null
                : progress >= 1
                    ? (
                        <Parent className="bg-yellow-100 text-yellow-700 dark:bg-yellow-300 dark:text-yellow-900">
                            <IconWrapper>
                                <Trophy size={'1rem'} />
                            </IconWrapper>
                            <TextWrapper>Done</TextWrapper>
                        </Parent>
                    )
                    : progress >= 0.5
                        ? (
                            <Parent className="bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300">
                                <IconWrapper>
                                    <Trophy size={'1rem'} />
                                </IconWrapper>
                                <TextWrapper>Halfway</TextWrapper>
                            </Parent>
                        )
                        : (
                            <Parent className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-500">
                                <IconWrapper>
                                    <Trophy size={'1rem'} />
                                </IconWrapper>
                                <TextWrapper>Started</TextWrapper>
                            </Parent>
                        )
        )

    return (
        <AnimatePresence>
            {Badge}
        </AnimatePresence>);
};
