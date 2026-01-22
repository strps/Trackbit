import { Field } from "@/components/Fields/FieldBase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getFieldInput } from "./fieldMapper";
import { DynamicFormProps, FormFieldConfig } from "./types";

export function DynamicForm<TFieldValues extends Record<string, any> = any>({
    form,
    config,
    onSubmit,
    submitText = "Submit",
    submitClassName,
    className,
    orientation: globalOrientation,
}: DynamicFormProps<TFieldValues>) {
    const { formState } = form;
    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className={cn("space-y-6", className)}>
            {config.map((fieldConfig: FormFieldConfig) => {
                if (fieldConfig.hidden) return null;

                const field = getFieldInput(fieldConfig, form);

                return field
            })}

            <div className="flex justify-end pt-4">
                <Button
                    type="submit"
                    disabled={formState.isSubmitting || formState.isLoading}
                    className={submitClassName}
                >
                    {formState.isSubmitting ? "Submitting..." : submitText}
                </Button>
            </div>
        </form>
    );
}