// components/fields/TextAreaField.tsx

import { Textarea } from "@/components/ui/textarea";
import { Field, type FieldProps, type InputProps } from "@/components/Fields/FieldBase";
import React from "react";
import { cn } from "@/lib/utils";

/**
 * Props specific to the TextArea input (extends the shared InputProps contract).
 * Additional Textarea-specific props can be added here if needed in the future.
 */
type TextAreaFieldInputProps = InputProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * The actual input component rendered inside the generic Field.
 * It receives all props required by the Field contract and forwards remaining props to shadcn's Textarea.
 */
const TextAreaFieldInput: React.FC<TextAreaFieldInputProps> = ({
    field,
    fieldState,
    formState,
    placeholder,
    className,
    disabled,
    ...rest
}) => {
    return (
        <Textarea
            placeholder={placeholder}
            {...field}
            disabled={disabled}
            aria-invalid={!fieldState.invalid ? undefined : true}
            className={cn("resize-none", className)} // optional default styling; adjust as needed
            {...rest}
        />
    );
};

/**
 * Convenience wrapper around the generic Field component specifically for textarea fields.
 * Usage:
 *   <TextAreaField
 *     name="description"
 *     label="Description"
 *     form={form}
 *     placeholder="Enter a detailed description..."
 *     description="Optional additional information"
 *     className="col-span-2"
 *   />
 */

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

type TextAreaFieldProps = Omit<FieldProps, "fieldInput">

export const TextAreaField: React.FC<TextAreaFieldProps> = ({
    name,
    label,
    form,
    placeholder,
    description,
    orientation,
    className,
    disabled,
    ...textareaProps
}) => {
    return (
        <Field
            name={name}
            label={label}
            form={form}
            placeholder={placeholder}
            description={description}
            orientation={orientation}
            className={className}
            disabled={disabled}
            fieldInput={(props) => (
                <TextAreaFieldInput {...props} {...textareaProps} />
            )}
        />
    );
};