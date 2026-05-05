import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Bug, MessageSquare, CheckCircle2, MapPin } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { useTranslation } from "react-i18next";

const API_URL = `${import.meta.env.VITE_API_URL}/issues`;

const TYPE_IDS = [
    { value: "bug" as const, icon: Bug },
    { value: "feedback" as const, icon: MessageSquare },
];

type IssueType = "bug" | "feedback";

interface FeedbackModalProps {
    open: boolean;
    onClose: () => void;
    initialStackTrace?: string;
    initialType?: IssueType;
}

export const FeedbackModal = ({ open, onClose, initialStackTrace, initialType }: FeedbackModalProps) => {
    const { t } = useTranslation('issues');
    const [type, setType] = useState<IssueType>("bug");
    const [description, setDescription] = useState("");
    const [path, setPath] = useState("");
    const [stackTrace, setStackTrace] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (open) {
            setPath(window.location.pathname);
            setDescription("");
            setType(initialType ?? "bug");
            setStackTrace(initialStackTrace ?? "");
            setSubmitted(false);
            setError("");
        }
    }, [open]);

    const handleSubmit = async () => {
        if (!description.trim()) return;
        setIsSubmitting(true);
        setError("");
        try {
            const res = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    type,
                    description,
                    path,
                    ...(stackTrace ? { stackTrace } : {}),
                }),
            });
            if (!res.ok) throw new Error("Failed to submit");
            setSubmitted(true);
            setTimeout(onClose, 2000);
        } catch {
            setError(t('modal.error'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                {submitted ? (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                        <CheckCircle2 className="h-10 w-10 text-primary" />
                        <DialogTitle>{t('modal.success_title')}</DialogTitle>
                        <p className="text-sm text-muted-foreground">{t('modal.success_message')}</p>
                    </div>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>{t('modal.title')}</DialogTitle>
                        </DialogHeader>

                        <div className="flex flex-col gap-5">
                            <div className="flex gap-2">
                                {TYPE_IDS.map(({ value, icon: Icon }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setType(value)}
                                        className={cn(
                                            "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                                            type === value
                                                ? "border-primary bg-primary/10 text-primary"
                                                : "border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {t(`type.${value}.label`)}
                                    </button>
                                ))}
                            </div>

                            <div className="flex flex-col gap-2">
                                <p className="text-sm font-medium">{t(`type.${type}.question`)}</p>
                                <Textarea
                                    placeholder={t(`type.${type}.placeholder`)}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={4}
                                    className="resize-none"
                                />
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{path}</span>
                            </div>

                            {error && <p className="text-xs text-destructive">{error}</p>}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={onClose}>
                                {t('modal.cancel')}
                            </Button>
                            <Button onClick={handleSubmit} disabled={!description.trim() || isSubmitting}>
                                {isSubmitting ? t('modal.sending') : t('modal.send')}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};
