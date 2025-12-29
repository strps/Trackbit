import { Controller, ControllerFieldState, ControllerRenderProps, FieldValues, UseFormReturn, UseFormStateReturn } from "react-hook-form";
import { Field as ShadcnField, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
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



export const TextField = ({ ...props }: Omit<FieldProps, "fieldInput">) => <Field fieldInput={TextFieldInput} {...props} />
export const NumberField = ({ ...props }: Omit<FieldProps, "fieldInput">) => <Field fieldInput={NumberFieldInput} {...props} />

interface RangeFieldProps extends Omit<FieldProps, "fieldInput"> {
    min?: number;
    max?: number;
    step?: number;
}

export const RangeField = ({ min, max, step, ...props }: RangeFieldProps) => <Field fieldInput={(iprops) => <RangeFieldInput min={min} max={max} step={step} {...iprops} />} {...props} />



export const TextFieldInput = (props: InputProps) => {
    const {
        id,
        placeholder,
        "aria-valid": ariaValid,
        field,
        fieldState,
        className,
    } = props;
    console.log(JSON.stringify(fieldState));
    return (
        <Input
            id={id}
            placeholder={placeholder}
            aria-invalid={ariaValid}
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
    const currentValue = Number(field.value ?? min);

    const sliderValue = [currentValue] as number[];

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value === "" ? min : Number(e.target.value);
        if (!isNaN(val)) {
            const clamped = Math.max(min, Math.min(max, val));
            field.onChange(clamped);
        }
    };

    const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        // Ensure value is clamped and integer on blur
        const val = e.target.value === "" ? min : Number(e.target.value);
        if (!isNaN(val)) {
            const clamped = Math.max(min, Math.min(max, Math.round(val / step) * step));
            field.onChange(clamped);
        }
    };

    return (
        <div className="flex items-center gap-4">
            <Slider
                id={id}
                min={min}
                max={max}
                step={step}
                value={sliderValue}
                onValueChange={(vals) => field.onChange(vals[0])}
                aria-invalid={!ariaValid}
                className="flex-1"
            />
            <Input
                type="number"
                min={min}
                max={max}
                step={step}
                value={currentValue}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                className="w-12 py-1 text-center text-4xl font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border-0 bg-transparent focus-visible:bg-transparent focus-visible:border-0 shadow-none focus-visible:shadow-none"
                aria-invalid={!ariaValid}
            />
        </div>
    );
};






// <span className="w-12 text-center font-bold text-xl py-1 rounded-lg bg-slate-100 dark:bg-slate-700">
//     {currentValue}
// </span>











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