import { Loader2 } from "lucide-react";

export function LoadingState({ label }: { label: string }) {
    return (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading {label}...
        </div>
    );
}
