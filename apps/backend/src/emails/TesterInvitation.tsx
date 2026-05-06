import { Button, Section, Text } from "@react-email/components";
import { BaseEmail } from "./BaseEmail";
import type { TesterInvitationStrings } from "../i18n/email-strings";

interface TesterInvitationEmailProps {
    invitationUrl: string;
    strings: TesterInvitationStrings;
}

export const TesterInvitationEmail = ({ invitationUrl, strings }: TesterInvitationEmailProps) => (
    <BaseEmail
        previewText={strings.preview}
        heading={strings.heading}
        footer={strings.footer}
    >
        <Section className="mt-6">
            <Text className="text-gray-700">{strings.greeting}</Text>
            <Text className="text-gray-700">{strings.body1}</Text>
            <Text className="text-gray-700">{strings.body2}</Text>
            <Section className="text-center my-8">
                <Button href={invitationUrl} className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium text-lg">
                    {strings.button}
                </Button>
            </Section>
            <Text className="text-gray-600 text-sm">
                {strings.linkPrompt} <br />
                <a href={invitationUrl} className="text-primary underline">{invitationUrl}</a>
            </Text>
        </Section>
    </BaseEmail>
);
