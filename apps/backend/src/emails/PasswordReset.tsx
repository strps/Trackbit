import { Button, Container, Head, Heading, Hr, Html, Preview, Section, Text, Tailwind } from "@react-email/components";

interface PasswordResetEmailProps {
    url: string;
    userName?: string;
}

export const PasswordResetEmail = ({ url, userName = "User" }: PasswordResetEmailProps) => (
    <Html>
        <Head />
        <Preview>Reset your Trackbit password</Preview>
        <Tailwind>
            <body className="bg-gray-100 font-sans">
                <Container className="bg-white mx-auto my-8 p-8 rounded-lg shadow-md max-w-lg">
                    <Heading className="text-2xl font-bold text-center text-gray-900">Password Reset Request</Heading>
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
                    <Hr className="my-8 border-gray-300" />
                    <Text className="text-gray-500 text-sm text-center">
                        If you didn't request this, please ignore this email—your password remains unchanged.
                    </Text>
                </Container>
            </body>
        </Tailwind>
    </Html>
);