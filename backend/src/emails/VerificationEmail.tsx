import { Button, Container, Head, Heading, Hr, Html, Preview, Section, Text, Tailwind } from "@react-email/components";
import * as React from "react";


interface VerificationEmailProps {
    url: string;
    userName?: string;
}

export const VerificationEmail = ({ url, userName = "User" }: VerificationEmailProps) => {

    const frontendBase = process.env.FRONT_URL

    const verificationUrl = new URL(url);
    verificationUrl.searchParams.delete("callbackURL");
    const cleanUrl = verificationUrl.toString();
    // Append the original backend URL as a query parameter for the frontend to handle verification
    const verificationLink = `${frontendBase}/verify-email?backendUrl=${encodeURIComponent(cleanUrl)}`;

    return (
        <Html>
            <Head />
            <Preview>Verify your email to activate your Trackbit account</Preview>
            <Tailwind>
                <body className="bg-gray-100 font-sans">
                    <Container className="bg-white mx-auto my-8 p-8 rounded-lg shadow-md max-w-lg">
                        <Heading className="text-2xl font-bold text-center text-gray-900">Welcome to Trackbit!</Heading>
                        <Section className="mt-6">
                            <Text className="text-gray-700">Hello {userName},</Text>
                            <Text className="text-gray-700">
                                Thank you for signing up. Click the button below to verify your email address.
                            </Text>
                            <Section className="text-center my-8">
                                <Button href={verificationLink} className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium text-lg">
                                    Verify Email Address
                                </Button>
                            </Section>
                            <Text className="text-gray-600 text-sm">
                                Or copy and paste this link into your browser: <br />
                                <a href={verificationLink} className="text-primary underline">{verificationLink}</a>
                            </Text>
                        </Section>
                        <Hr className="my-8 border-gray-300" />
                        <Text className="text-gray-500 text-sm text-center">
                            If you didn't create an account, you can safely ignore this email.
                        </Text>
                    </Container>
                </body>
            </Tailwind>
        </Html>
    )
}