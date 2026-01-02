import { Input } from "../ui/input";
import { Slider } from "../ui/slider";
import { Field, FieldProps, InputProps } from "./FieldBase";

interface RangeFieldInputProps extends InputProps {
    min?: number;
    max?: number;
    step?: number;
}



interface RangeFieldProps extends Omit<FieldProps, "fieldInput"> {
    min?: number;
    max?: number;
    step?: number;
}

export const RangeField = ({ min, max, step, ...props }: RangeFieldProps) => <Field fieldInput={(iprops) => <RangeFieldInput min={min} max={max} step={step} {...iprops} />} {...props} />

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

