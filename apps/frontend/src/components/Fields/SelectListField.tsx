/* ... existing imports ... */

import { cn } from "@/lib/utils";
import { Field, FieldProps, InputProps } from "./FieldBase";

/**
 * Base type for a select option. Consumers can extend it with additional data.
 */
export type SelectOption<T = {}> = {
    value: string;
    label: string;
} & T;

/**
 * Props passed to each custom option component.
 * 
 * The generic T allows extra fields from SelectOption<T> to flow through
 * to the rendered option component.
 */
export interface SelectListOptionComponentProps<T = {}> {
    value: string;
    label: string;
    isSelected: boolean;
    onToggle: (value: string) => void;
    disabled?: boolean;
    /** Any additional data attached to the option */
    [key: string]: any; // Allows arbitrary extra props from T
}

/**
 * Props for the SelectListField component.
 * The generic T represents extra data on each option.
 */
export interface SelectListFieldProps<T = {}>
    extends Omit<FieldProps, "fieldInput"> {
    options: SelectOption<T>[];
    /** Custom component used to render each option */
    optionComponent: React.FC<SelectListOptionComponentProps<T>>;
    mode?: "single" | "multi";
}

/**
 * SelectListField – a custom field supporting single or multi-select via a fully customizable list.
 */
export const SelectListField = <T = {}>({
    options,
    optionComponent,
    mode = "single",
    ...fieldProps
}: SelectListFieldProps<T>) => (
    <Field
        {...fieldProps}
        fieldInput={(inputProps: InputProps) => (
            <SelectListFieldInput
                {...inputProps}
                options={options}
                optionComponent={optionComponent}
                mode={mode}
            />
        )}
    />
);

/**
 * Internal input component that renders the list of options.
 */
export const SelectListFieldInput = <T = {}>({
    id,
    field,
    fieldState,
    "aria-valid": ariaValid,
    options,
    optionComponent: OptionComponent,
    className,
    disabled,
    mode = "single",
}: InputProps & {
    options: SelectOption<T>[];
    optionComponent: React.FC<SelectListOptionComponentProps<T>>;
    mode?: "single" | "multi";
}) => {
    const isMulti = mode === "multi";

    const currentValue = isMulti
        ? Array.isArray(field.value) ? field.value : []
        : typeof field.value === "string" ? field.value : "";

    const toggleOption = (value: string) => {
        if (disabled) return;

        if (isMulti) {
            const newValue = (currentValue as string[]).includes(value)
                ? (currentValue as string[]).filter((v) => v !== value)
                : [...(currentValue as string[]), value];
            field.onChange(newValue);
        } else {
            const newValue = currentValue === value ? "" : value;
            field.onChange(newValue);
        }
    };

    const role = isMulti ? "group" : "radiogroup";
    const optionRole = isMulti ? "checkbox" : "radio";

    return (
        <div
            role={role}
            aria-labelledby={id}
            aria-invalid={!ariaValid}
            aria-multiselectable={isMulti ? "true" : undefined}
            className={cn("", className)}
        >
            {options.map((option) => {
                const isSelected = isMulti
                    ? (currentValue as string[]).includes(option.value)
                    : currentValue === option.value;

                return (
                    <div
                        key={option.value}
                        role={optionRole}
                        aria-checked={isSelected}
                        tabIndex={disabled ? -1 : 0}
                        onKeyDown={(e) => {
                            if (!disabled && (e.key === "Enter" || e.key === " ")) {
                                e.preventDefault();
                                toggleOption(option.value);
                            }
                        }}
                        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
                    >
                        <OptionComponent
                            value={option.value}
                            label={option.label}
                            isSelected={isSelected}
                            onToggle={toggleOption}
                            disabled={disabled}
                            tabIndex={-1}
                            // Spread all additional properties from the option
                            {...(option as T)}
                        />
                    </div>
                );
            })}
        </div>
    );
};