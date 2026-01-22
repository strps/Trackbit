import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Field, FieldProps, InputProps } from "./FieldBase";
import { Eye, EyeOff } from "lucide-react";

// interface PasswordFieldInputProps extends InputProps {showPassword: boolean;}

export const PasswordFieldInput: React.FC<InputProps> = ({ id, placeholder, "aria-invalid": ariaValid, field, className }) => {
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
