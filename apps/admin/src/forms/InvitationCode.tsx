import React from "react";
import { useForm } from "react-hook-form";
import {
    DynamicForm,
    FormFieldConfig,
    InputProps,
    Label,
    Input,
    RadioGroup,
    RadioGroupItem
} from "@trackbit/ui";

const methodOptions = [
    { value: "single", label: "Request for a single email" },
    { value: "multiple", label: "Request for multiple emails (one per line)" },
    { value: "file", label: "Upload a file with emails (TXT or CSV)" },
];

// Custom radio group component for method selection
const MethodChoiceCustom: React.FC<InputProps> = ({
    field,
    disabled,
    className,
}) => {
    return (
        <RadioGroup
            onValueChange={field.onChange}
            value={field.value}
            disabled={disabled}
            className={className}
        >
            {methodOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={option.value} />
                    <Label htmlFor={option.value}>{option.label}</Label>
                </div>
            ))}
        </RadioGroup>
    );
};

// Custom file upload component (simple native input; extend later if needed)
const FileUploadCustom: React.FC<InputProps> = ({
    field,
    fieldState,
    placeholder,
    disabled,
    className,
}) => {
    return (
        <div>
            <Input
                type="file"
                accept=".txt,.csv"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.onChange(e.target.files?.[0] || null)}
                disabled={disabled}
                className={className}
                aria-invalid={fieldState.invalid}
            />
            <p className="text-sm text-muted-foreground mt-2">
                Upload a TXT or CSV file containing email addresses.
            </p>
        </div>
    );
};

export function InvitationCodeForm() {
    const form = useForm({
        defaultValues: {
            method: "single",
            singleEmail: "",
            multipleEmails: "",
            emailFile: null,
            reason: "",
        },
    });

    const watchedMethod = form.watch("method");

    const config: FormFieldConfig[] = [
        {
            name: "method",
            type: "custom",
            label: "How would you like to request invitation codes?",
            customComponent: MethodChoiceCustom,
        },
        {
            name: "singleEmail",
            type: "text",
            label: "Email address",
            placeholder: "user@example.com",
            hidden: watchedMethod !== "single",
        },
        {
            name: "multipleEmails",
            type: "textarea",
            label: "Email addresses (one per line)",
            placeholder: "user1@example.com\nuser2@example.com\n...",
            hidden: watchedMethod !== "multiple",
        },
        {
            name: "emailFile",
            type: "custom",
            label: "Upload email file",
            customComponent: FileUploadCustom,
            hidden: watchedMethod !== "file",
        },
        {
            name: "reason",
            type: "textarea",
            label: "Reason for request (optional)",
            placeholder: "Briefly explain why you need invitation codes...",
            description: "This helps us prioritize and process your request faster.",
        },
    ];

    const onSubmit = (data: any) => {
        // Later: Process single/multiple emails or parse uploaded file
        alert("Submission received! (Check console for data)");
    };

    return (
        <div className="max-w-2xl mx-auto p-6">
            <h1 className="text-3xl font-bold mb-2">Request Invitation Codes</h1>
            <p className="text-muted-foreground mb-8">
                Use this form to request invitation codes for your application. We will review and send codes to the provided email(s).
            </p>

            <DynamicForm
                form={form}
                config={config}
                onSubmit={onSubmit}
                submitText="Submit Request"
                className="space-y-8"
            />
        </div>
    );
}