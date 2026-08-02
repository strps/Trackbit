import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';
import { TextAreaField } from '@/shared/components/Fields/TextAreaField';
import { TextField } from '@/shared/components/Fields/TextField';
import { Button } from '@/shared/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/components/ui/dialog';
import type { ExerciseListWithItems } from './use-exercise-lists';

const listFormSchema = z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(500),
});

type ListFormValues = z.infer<typeof listFormSchema>;

interface ListFormDialogProps {
    open: boolean;
    // Present ⇒ rename that list; absent ⇒ create a new one.
    list?: ExerciseListWithItems | null;
    onClose: () => void;
    onSubmit: (values: { name: string; description: string | null }) => void;
    isSaving?: boolean;
}

export const ListFormDialog = ({ open, list, onClose, onSubmit, isSaving }: ListFormDialogProps) => {
    const { t } = useTranslation('lists');
    const isEdit = !!list;

    const form = useForm<ListFormValues>({
        defaultValues: { name: '', description: '' },
        resolver: zodResolver(listFormSchema),
    });

    // The dialog is mounted once and reused, so the fields have to be reset from
    // whichever list it was opened for.
    useEffect(() => {
        if (!open) return;
        form.reset({ name: list?.name ?? '', description: list?.description ?? '' });
    }, [open, list, form]);

    const handleSubmit = (values: ListFormValues) => {
        onSubmit({
            name: values.name.trim(),
            description: values.description.trim() || null,
        });
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{isEdit ? t('form.edit_title') : t('form.create_title')}</DialogTitle>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <TextField
                        name="name"
                        label={t('form.name_label')}
                        placeholder={t('form.name_placeholder')}
                        form={form}
                    />
                    <TextAreaField
                        name="description"
                        label={t('form.description_label')}
                        placeholder={t('form.description_placeholder')}
                        form={form}
                    />

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            {t('form.cancel')}
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                            {isEdit ? t('form.save') : t('form.create')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
