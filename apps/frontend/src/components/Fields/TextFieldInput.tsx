import { Input } from "../ui/input";
import { Field, FieldProps, InputProps } from "./FieldBase";

export const TextField = ({ ...props }: Omit<FieldProps, "fieldInput">) => <Field fieldInput={TextFieldInput} {...props} />

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

