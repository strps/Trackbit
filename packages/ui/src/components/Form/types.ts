import { UseFormReturn } from "react-hook-form";
import { SelectOption } from "@/components/Fields/ChoiceListField";
import { InputProps } from "../Fields/FieldBase";

/**
 * Supported field types that map directly to existing specialized components.
 */
export type FieldType =
    | "text"
    | "number"
    | "textarea"
    | "range"
    | "password"
    | "choice"
    | "custom"
    | 'file'

/**
 * Base configuration shared across all field types.
 */
interface BaseFormFieldConfig {
    name: string;
    type: FieldType;
    label?: string;
    placeholder?: string;
    description?: string;
    orientation?: "horizontal" | "vertical" | "responsive" | null;
    disabled?: boolean;
    className?: string;
    hidden?: boolean; // Allows inclusion in form state without rendering
}

/**
 * Specific configuration extensions per field type.
 */

/* Text, Number, Textarea, Password – use standard props */
interface StandardFieldConfig extends BaseFormFieldConfig {
    type: "text" | "number" | "textarea" | "password";
}

/* File field */
export interface FileFieldConfig extends BaseFormFieldConfig {
    type: "file";
    multiple?: boolean;  // Allow multiple files if needed (default: false for single list file)
    accept?: string;     // e.g., ".csv,.txt" to restrict file types
}

/* Range field – requires min/max/step */
interface RangeFieldConfig extends BaseFormFieldConfig {
    type: "range";
    min?: number;
    max?: number;
    step?: number;
}

/* Choice field (single or multi-select via ChoiceListField) */
export interface ChoiceFieldConfig<T = {}> extends BaseFormFieldConfig {
    type: "choice";
    mode?: "single" | "multi";
    options: SelectOption<T>[];
    optionComponent: React.FC<any>; // Will be refined in mapper
}

/* Fully custom field – bypasses built-in components */
interface CustomFieldConfig extends BaseFormFieldConfig {
    type: "custom";
    /**
     * Custom component used as the `fieldInput` prop in Field.
     * It receives the full InputProps from the Controller render.
     */
    customComponent: React.FC<InputProps>;
}

/**
 * Union of all possible field configurations.
 */
export type FormFieldConfig<T = {}> =
    | StandardFieldConfig
    | RangeFieldConfig
    | ChoiceFieldConfig<T>
    | CustomFieldConfig
    | FileFieldConfig;

/**
 * Props for the DynamicForm component.
 */
export interface DynamicFormProps<TFieldValues extends Record<string, any> = any> {
    form: UseFormReturn<TFieldValues>;
    config: FormFieldConfig[];
    onSubmit: (data: TFieldValues) => void;
    submitText?: string;
    submitClassName?: string;
    className?: string;
    /** Optional global orientation applied to all fields unless overridden */
    orientation?: "horizontal" | "vertical" | "responsive" | null;
}