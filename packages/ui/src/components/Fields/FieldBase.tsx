import { Controller, ControllerFieldState, ControllerRenderProps, FieldValues, UseFormReturn, UseFormStateReturn } from "react-hook-form";
import { Field as ShadcnField, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "../ui/input";
import { Slider } from "../ui/slider";
import { Button } from "../ui/button";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/*
Areas for Potential Improvement

Aria Attribute Handling:
The prop is named "aria-valid" (a string literal key), which is unconventional and potentially confusing. A more standard approach would be to use aria-invalid={!fieldState.invalid} directly on the input component, as most screen readers expect aria-invalid. The current inversion (aria-invalid={!ariaValid}) works but adds unnecessary complexity.

Error Display Granularity:
FieldError receives an array of errors (errors={[fieldState.error]}), which suggests support for multiple errors per field. However, React Hook Form typically provides a single error per field unless using advanced validation. Simplifying to a single error object could reduce overhead unless multiple errors are intentionally supported.

Orientation Prop:
The orientation prop is passed through but not actively used in all child inputs. Ensure that custom inputs (e.g., RangeFieldInput) respect it if horizontal layouts are needed.

ClassName Propagation:
The className prop is forwarded only to the custom FieldInput, which is appropriate, but consider whether some fields might need additional wrapper classes for layout consistency.

 */


export interface InputProps {
    id: string;
    "aria-valid": boolean;
    placeholder?: string;
    // react-hook-form field props
    field: ControllerRenderProps<FieldValues, string>;
    fieldState: ControllerFieldState;
    formState: UseFormStateReturn<any>
    className?: string;
    disabled?: boolean;
}

export interface FieldProps {
    name: string;
    label?: string;
    form: UseFormReturn<any>;
    fieldInput: React.FC<InputProps>;
    placeholder?: string;
    description?: string;
    orientation?: "horizontal" | "vertical" | "responsive" | null;
    className?: string;
    disabled?: boolean;
}

export const Field = ({ name, label, form, placeholder, fieldInput: FieldInput, description, orientation, className, disabled }: FieldProps) => {

    return (

        <Controller
            name={name}
            control={form.control}
            render={({ field, fieldState, formState }) => (
                <ShadcnField
                    data-invalid={fieldState.invalid}
                    orientation={orientation}
                >
                    {label && <FieldLabel htmlFor={field.name} className="block text-sm font-bold">{label}</FieldLabel>}
                    <FieldInput
                        placeholder={placeholder}
                        id={field.name}
                        aria-valid={fieldState.invalid}
                        field={field}
                        fieldState={fieldState}
                        formState={formState}
                        className={className}
                        disabled={disabled}
                    />
                    {description && <FieldDescription>{description}</FieldDescription>}
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </ShadcnField>
            )}
        />


    )
}








