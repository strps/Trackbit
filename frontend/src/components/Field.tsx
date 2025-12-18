import { Controller, ControllerFieldState, ControllerRenderProps, FieldValues, UseFormReturn, UseFormStateReturn } from "react-hook-form";
import { Field as SField, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "./ui/input";
import { Slider } from "./ui/slider";
import { Button } from "./ui/button";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

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


interface InputProps {
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

interface FieldProps {
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
                <SField
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
                    {description && <FieldDescription>
                        {description}
                    </FieldDescription>}
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </SField>
            )}
        />


    )
}



export const TextField = ({ ...props }: Omit<FieldProps, "fieldInput">) => <Field fieldInput={TextFieldInput} {...props} />
export const NumberField = ({ ...props }: Omit<FieldProps, "fieldInput">) => <Field fieldInput={NumberFieldInput} {...props} />

interface RangeFieldProps extends Omit<FieldProps, "fieldInput"> {
    min?: number;
    max?: number;
    step?: number;
}

export const RangeField = ({ min, max, step, ...props }: RangeFieldProps) => <Field fieldInput={(iprops) => <RangeFieldInput min={min} max={max} step={step} {...iprops} />} {...props} />



export const TextFieldInput = ({
    id,
    placeholder,
    "aria-valid": ariaValid,
    field,
    className,
}: InputProps) => {
    return (
        <Input
            id={id}
            placeholder={placeholder}
            aria-invalid={!ariaValid}
            className={className}
            {...field}
        />
    );
};



export const NumberFieldInput = ({
    id,
    field,
    placeholder,
    "aria-valid": ariaValid,
}: InputProps) => {
    return (
        <Input
            id={id}
            type="number"
            placeholder={placeholder}
            aria-invalid={!ariaValid}

            {...field}
        />
    );
};


interface RangeFieldInputProps extends InputProps {
    min?: number;
    max?: number;
    step?: number;
}

export const RangeFieldInput = ({
    id,
    field,
    min = 0,
    max = 100,
    step = 1,
    "aria-valid": ariaValid,
}: RangeFieldInputProps) => {
    const { onChange, value, ...fieldProps } = field
    return (
        <div className="flex items-center gap-4">
            <Slider
                id={id}
                min={min}
                max={max}
                step={step}
                onValueChange={(value) => onChange(value)}
                aria-invalid={!ariaValid}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900 dark:accent-white"
                {...fieldProps}
            />
            <span className="w-12 text-center font-bold text-xl py-1 rounded-lg bg-slate-100 dark:bg-slate-700">
                {value}
            </span>
        </div>
    );
};


interface PasswordFieldInputProps extends InputProps { }

export const PasswordFieldInput = ({ id, placeholder, "aria-valid": ariaValid, field, className }: PasswordFieldInputProps) => {
    const [showPassword, setShowPassword] = useState(false);
    return (
        <div className="relative">
            <Input
                id={id}
                type={showPassword ? "text" : "password"}
                placeholder={placeholder}
                aria-invalid={!ariaValid}
                className={className}
                {...field}
            />
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0"
                onClick={() => setShowPassword(!showPassword)}
            >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
        </div>
    );
};

export const PasswordField = ({ ...props }: Omit<FieldProps, "fieldInput">) => <Field fieldInput={PasswordFieldInput} {...props} />;