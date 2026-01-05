import React from "react";
import { UseFormReturn } from "react-hook-form";
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

                const {
                    name,
                    label,
                    placeholder,
                    description,
                    orientation,
                    disabled,
                    className: fieldClassName,
                } = fieldConfig;

                const fieldInput = getFieldInput(fieldConfig);

                return (
                    <Field
                        key={name}
                        name={name}
                        form={form}
                        label={label}
                        placeholder={placeholder}
                        description={description}
                        orientation={orientation ?? globalOrientation}
                        disabled={disabled || formState.isSubmitting}
                        className={fieldClassName}
                        fieldInput={fieldInput}
                    />
                );
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