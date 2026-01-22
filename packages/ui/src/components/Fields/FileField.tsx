// components/Fields/FileField.tsx

import { Input } from "@/components/ui/input";
import { Field, FieldProps, InputProps } from "./FieldBase";
import React from "react";

export interface FileFieldInputProps extends InputProps {
    multiple?: boolean;
    accept?: string;
}

export const FileFieldInput: React.FC<FileFieldInputProps> = ({
    id,
    field,
    fieldState,
    "aria-invalid": ariaInvalid,
    multiple = false,
    accept,
    className,
    disabled,
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (multiple) {
            field.onChange(e.target.files);  // Array of files
        } else {
            field.onChange(e.target.files?.[0] ?? null);  // Single file or null
        }
    };

    return (
        <Input
            id={id}
            type="file"
            multiple={multiple}
            accept={accept}
            onChange={handleChange}
            aria-invalid={ariaInvalid}
            className={className}
            disabled={disabled}
        />
    );
};

export interface FileFieldProps extends Omit<FieldProps, "fieldInput"> {
    multiple?: boolean;
    accept?: string;
}

export const FileField: React.FC<FileFieldProps> = ({
    multiple,
    accept,
    ...props
}) => (
    <Field
        fieldInput={(inputProps) => (
            <FileFieldInput multiple={multiple} accept={accept} {...inputProps} />
        )}
        {...props}
    />
);