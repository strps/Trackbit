import { Input } from "../ui/input";
import { Field, FieldProps, InputProps } from "./FieldBase";

export const NumberField = ({ ...props }: Omit<FieldProps, "fieldInput">) => <Field fieldInput={NumberFieldInput} {...props} />

export const NumberFieldInput: React.FC<InputProps> = ({
    id,
    field,
    placeholder,
    "aria-invalid": ariaValid,
}: InputProps) => {
    return (
        <Input
            id={id}
            type="number"
            placeholder={placeholder}
            aria-invalid={ariaValid}
            {...field}
        />
    );
};