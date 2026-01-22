import { Button, Section, Text } from "@react-email/components";
import { BaseEmail } from "./BaseEmail";

interface PasswordResetEmailProps {
    url: string;
    userName?: string;
}

export const PasswordResetEmail = ({ url, userName = "User" }: PasswordResetEmailProps) => (
    <BaseEmail
        previewText="Reset your Trackbit password"
        heading="Password Reset Request"
        footer="If you didn't request this, please ignore this email—your password remains unchanged."
    >
        <Section className="mt-6">
            <Text className="text-gray-700">Hello {userName},</Text>
            <Text className="text-gray-700">
                We received a request to reset your Trackbit password. Click the button below to set a new password. This link will expire in 1 hour for security.
            </Text>
            <Section className="text-center my-8">
                <Button href={url} className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium text-lg">
                    Reset Password
                </Button>
            </Section>
            <Text className="text-gray-600 text-sm">
                Or copy and paste this link into your browser: <br />
                <a href={url} className="text-primary underline">{url}</a>
            </Text>
        </Section>
    </BaseEmail>
);