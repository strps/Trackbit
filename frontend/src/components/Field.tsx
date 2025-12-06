import { Controller, ControllerFieldState, ControllerRenderProps, FieldValues, UseFormReturn, UseFormStateReturn } from "react-hook-form";
import { Field as SField, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "./ui/input";
import { Slider } from "./ui/slider";

interface InputProps {
    id: string;
    "aria-valid": boolean;
    placeholder?: string;
    // react-hook-form field props
    field: ControllerRenderProps<FieldValues, string>;
    fieldState: ControllerFieldState;
    formState: UseFormStateReturn<any>
    className?: string;
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
}

export const Field = ({ name, label, form, placeholder, fieldInput: FieldInput, description, orientation, className }: FieldProps) => {

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