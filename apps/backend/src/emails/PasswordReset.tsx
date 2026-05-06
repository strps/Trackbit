import { Button, Section, Text } from "@react-email/components";
import { BaseEmail } from "./BaseEmail";
import type { PasswordResetStrings } from "../i18n/email-strings";

interface PasswordResetEmailProps {
    url: string;
    strings: PasswordResetStrings;
}

export const PasswordResetEmail = ({ url, strings }: PasswordResetEmailProps) => (
    <BaseEmail
        previewText={strings.preview}
        heading={strings.heading}
        footer={strings.footer}
    >
        <Section className="mt-6">
            <Text className="text-gray-700">{strings.greeting}</Text>
            <Text className="text-gray-700">{strings.body}</Text>
            <Section className="text-center my-8">
                <Button href={url} className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium text-lg">
                    {strings.button}
                </Button>
            </Section>
            <Text className="text-gray-600 text-sm">
                {strings.linkPrompt} <br />
                <a href={url} className="text-primary underline">{url}</a>
            </Text>
        </Section>
    </BaseEmail>
);
