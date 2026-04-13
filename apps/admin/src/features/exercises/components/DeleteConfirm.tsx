import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@trackbit/ui";

interface DeleteConfirmProps {
    open: boolean;
    name: string;
    onConfirm: () => void;
    onCancel: () => void;
    description?: string;
}

export function DeleteConfirm({ open, name, onConfirm, onCancel, description }: DeleteConfirmProps) {
    return (
        <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete {name}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {description ?? `Are you sure you want to delete "${name}"? This cannot be undone.`}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
