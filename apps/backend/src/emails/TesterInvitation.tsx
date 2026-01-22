import { Button, Section, Text } from "@react-email/components";
import { BaseEmail } from "./BaseEmail";

interface TesterInvitationEmailProps {
    invitationUrl: string;
    userName?: string;
}

export const TesterInvitationEmail = ({ invitationUrl, userName = "there" }: TesterInvitationEmailProps) => (
    <BaseEmail
        previewText="You're invited to beta test Trackbit!"
        heading="Beta Tester Invitation"
        footer="Questions? Reply to this email. We appreciate your help!"
    >
        <Section className="mt-6">
            <Text className="text-gray-700">Hi {userName},</Text>
            <Text className="text-gray-700">
                We're excited to invite you to the Trackbit beta! As a tester, you'll get early access to our hybrid habit and workout tracker, including interactive heatmaps, gradient progress visuals, and more.
            </Text>
            <Text className="text-gray-700">
                Your feedback will help shape the app. Join now and start building stronger habits.
            </Text>
            <Section className="text-center my-8">
                <Button href={invitationUrl} className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium text-lg">
                    Accept Invitation & Sign Up
                </Button>
            </Section>
            <Text className="text-gray-600 text-sm">
                Or copy and paste this link: <br />
                <a href={invitationUrl} className="text-primary underline">{invitationUrl}</a>
            </Text>
        </Section>
    </BaseEmail>
);