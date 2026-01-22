import { Input } from "../ui/input";
import { Field, FieldProps, InputProps } from "./FieldBase";

export const TextField = ({ ...props }: Omit<FieldProps, "fieldInput">) => <Field fieldInput={TextFieldInput} {...props} />

export const TextFieldInput: React.FC<InputProps> = (props: InputProps) => {
    const {
        id,
        placeholder,
        "aria-invalid": ariaInvalid,
        field,
        fieldState,
        className,
    } = props;
    return (
        <Input
            id={id}
            placeholder={placeholder}
            aria-invalid={ariaInvalid}
            className={className}
            {...field}
        />
    );
};

