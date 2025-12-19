export declare const sendEmail: ({ to, subject, react, text, }: {
    to: string | string[];
    subject: string;
    react?: React.ReactElement;
    text?: string;
}) => Promise<{
    success: boolean;
    data: import("resend").CreateEmailResponse;
    error?: undefined;
} | {
    success: boolean;
    error: unknown;
    data?: undefined;
}>;
//# sourceMappingURL=email.d.ts.map