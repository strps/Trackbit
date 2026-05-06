import { Button, Section, Text } from "@react-email/components";
import { BaseEmail } from "./BaseEmail";
import type { VerificationStrings } from "../i18n/email-strings";

interface VerificationEmailProps {
    url: string;
    strings: VerificationStrings;
}

const frontendBase = process.env.FRONT_URL

export const VerificationEmail = ({ url, strings }: VerificationEmailProps) => {
    const verificationUrl = new URL(url);
    verificationUrl.searchParams.delete("callbackURL");
    const cleanUrl = verificationUrl.toString();
    // Append the original backend URL as a query parameter for the frontend to handle verification
    const verificationLink = `${frontendBase}/verify-email?backendUrl=${encodeURIComponent(cleanUrl)}`;

    return (
        <BaseEmail
            previewText={strings.preview}
            heading={strings.heading}
            footer={strings.footer}
        >
            <Section className="mt-6">
                <Text className="text-gray-700">{strings.greeting}</Text>
                <Text className="text-gray-700">{strings.body}</Text>
                <Section className="text-center my-8">
                    <Button href={verificationLink} className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium text-lg">
                        {strings.button}
                    </Button>
                </Section>
                <Text className="text-gray-600 text-sm">
                    {strings.linkPrompt} <br />
                    <a href={verificationLink} className="text-primary underline">{verificationLink}</a>
                </Text>
            </Section>
        </BaseEmail>
    )
}
