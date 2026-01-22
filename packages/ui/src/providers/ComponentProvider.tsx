import { AlertDialogHeader, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { SheetContent } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction } from "@radix-ui/react-alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Sheet } from "@/components/ui/sheet";

import React, { createContext, useContext, useState, useCallback } from "react";


type OverlayType = "dialog" | "sheet" | "drawer" | "alert-dialog";

interface OverlayState {
    isOpen: boolean;
    type: OverlayType | null;
    props: any;
    component: React.ReactNode | null;
}

interface OverlayContextType {
    show: (type: OverlayType, component: React.ReactNode, props?: any) => void;
    hide: () => void;
    openAlertDialog: (props: {
        title: string;
        description?: string;
        confirmText?: string;
        cancelText?: string;
        onConfirm: () => void;
        onCancel?: () => void;
    }) => void;
}

const OverlayContext = createContext<OverlayContextType | null>(null);

export const useOverlay = () => {
    const context = useContext(OverlayContext);
    if (!context) {
        throw new Error("useOverlay must be used within a ComponentProvider");
    }
    return context;
};

export function ComponentProvider({ children }: { children: React.ReactNode }) {
    const [overlay, setOverlay] = useState<OverlayState>({
        isOpen: false,
        type: null,
        props: {},
        component: null,
    });

    const hide = useCallback(() => {
        setOverlay((prev) => ({ ...prev, isOpen: false }));
        setTimeout(() => {
            setOverlay({ isOpen: false, type: null, props: {}, component: null });
        }, 300);
    }, []);

    const show = useCallback((type: OverlayType, component: React.ReactNode, props: any = {}) => {
        setOverlay({ isOpen: true, type, component, props });
    }, []);

    const openAlertDialog = useCallback((props: any) => {
        setOverlay({ isOpen: true, type: "alert-dialog", component: null, props });
    }, []);

    const handleOpenChange = (open: boolean) => {
        if (!open) hide();
    };

    return (
        <OverlayContext.Provider value={{ show, hide, openAlertDialog }}>
            <TooltipProvider>
                {children}
                <Toaster />
                {overlay.type === "dialog" && (
                    <Dialog open={overlay.isOpen} onOpenChange={handleOpenChange}>
                        <DialogContent {...overlay.props}>{overlay.component}</DialogContent>
                    </Dialog>
                )}
                {overlay.type === "sheet" && (
                    <Sheet open={overlay.isOpen} onOpenChange={handleOpenChange}>
                        <SheetContent {...overlay.props}>{overlay.component}</SheetContent>
                    </Sheet>
                )}
                {overlay.type === "drawer" && (
                    <Drawer open={overlay.isOpen} onOpenChange={handleOpenChange}>
                        <DrawerContent {...overlay.props}>{overlay.component}</DrawerContent>
                    </Drawer>
                )}
                {overlay.type === "alert-dialog" && (
                    <AlertDialog open={overlay.isOpen} onOpenChange={handleOpenChange}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>{overlay.props.title}</AlertDialogTitle>
                                {overlay.props.description && (
                                    <AlertDialogDescription>{overlay.props.description}</AlertDialogDescription>
                                )}
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel onClick={overlay.props.onCancel}>
                                    {overlay.props.cancelText || "Cancel"}
                                </AlertDialogCancel>
                                <AlertDialogAction onClick={() => {
                                    overlay.props.onConfirm?.();
                                    hide();
                                }}>
                                    {overlay.props.confirmText || "Continue"}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </TooltipProvider>
        </OverlayContext.Provider>
    );
}
