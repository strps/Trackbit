import { Button, Container, Head, Heading, Hr, Html, Preview, Section, Text, Tailwind } from "@react-email/components";

interface TesterInvitationEmailProps {
    invitationUrl: string;
    userName?: string;
}

export const TesterInvitationEmail = ({ invitationUrl, userName = "there" }: TesterInvitationEmailProps) => (
    <Html>
        <Head />
        <Preview>You're invited to beta test Trackbit!</Preview>
        <Tailwind>
            <body className="bg-gray-100 font-sans">
                <Container className="bg-white mx-auto my-8 p-8 rounded-lg shadow-md max-w-lg">
                    <Heading className="text-2xl font-bold text-center text-gray-900">Beta Tester Invitation</Heading>
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
                    <Hr className="my-8 border-gray-300" />
                    <Text className="text-gray-500 text-sm text-center">
                        Questions? Reply to this email. We appreciate your help!
                    </Text>
                </Container>
            </body>
        </Tailwind>
    </Html>
);