// src/providers/UIProvider.tsx
'use client'

import { Toaster, toast } from 'sonner'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import React, { createContext, useContext, useState, useCallback } from 'react'

type DialogVariant = 'default' | 'alert' | 'sheet'

interface DialogOptions {
    title?: React.ReactNode
    description?: React.ReactNode
    content?: React.ReactNode
    footer?: React.ReactNode
    confirmText?: string
    cancelText?: string
    variant?: DialogVariant
    onConfirm?: () => void | Promise<void>
    onCancel?: () => void
    onOpenChange?: (open: boolean) => void
}

interface UIContextValue {
    toast: typeof import('sonner').toast
    showDialog: (options: DialogOptions) => void
    closeDialog: () => void
    confirm: (message: string, title?: string) => Promise<boolean>
}

const UIContext = createContext<UIContextValue | undefined>(undefined)

export function UIProvider({ children }: { children: React.ReactNode }) {
    const [dialogOpen, setDialogOpen] = useState(false)
    const [dialogConfig, setDialogConfig] = useState<DialogOptions>({})

    const showDialog = useCallback((options: DialogOptions) => {
        setDialogConfig(options)
        setDialogOpen(true)
    }, [])

    const closeDialog = useCallback(() => {
        setDialogOpen(false)
    }, [])

    // Nice helper for classic confirm dialogs
    const confirm = useCallback(
        (message: string, title = 'Confirm action') =>
            new Promise<boolean>((resolve) => {
                showDialog({
                    title,
                    description: message,
                    variant: 'alert',
                    confirmText: 'Yes',
                    cancelText: 'No',
                    onConfirm: () => resolve(true),
                    onCancel: () => resolve(false),
                    onOpenChange: (open) => {
                        if (!open) resolve(false) // closed without action
                    },
                })
            }),
        [showDialog]
    )

    const value: UIContextValue = {
        toast,
        showDialog,
        closeDialog,
        confirm,
    }

    return (
        <UIContext.Provider value={value}>
            {children}

            {/* Sonner Toaster - always present */}
            <Toaster richColors position="top-right" closeButton />

            {/* Universal Dialog / AlertDialog / Sheet */}
            {dialogConfig.variant === 'sheet' ? (
                <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
                    <SheetContent>
                        {dialogConfig.content}
                    </SheetContent>
                </Sheet>
            ) : dialogConfig.variant === 'alert' ? (
                <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            {dialogConfig.title && <AlertDialogTitle>{dialogConfig.title}</AlertDialogTitle>}
                            {dialogConfig.description && (
                                <AlertDialogDescription>{dialogConfig.description}</AlertDialogDescription>
                            )}
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={dialogConfig.onCancel}>
                                {dialogConfig.cancelText ?? 'Cancel'}
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={async () => {
                                    await dialogConfig.onConfirm?.()
                                    closeDialog()
                                }}
                            >
                                {dialogConfig.confirmText ?? 'Continue'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            ) : (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            {dialogConfig.title && <DialogTitle>{dialogConfig.title}</DialogTitle>}
                            {dialogConfig.description && (
                                <DialogDescription>{dialogConfig.description}</DialogDescription>
                            )}
                        </DialogHeader>

                        {dialogConfig.content}

                        {dialogConfig.footer && <DialogFooter>{dialogConfig.footer}</DialogFooter>}
                    </DialogContent>
                </Dialog>
            )}
        </UIContext.Provider>
    )
}

export function useUI() {
    const context = useContext(UIContext)
    if (!context) {
        throw new Error('useUI must be used within UIProvider')
    }
    return context
}