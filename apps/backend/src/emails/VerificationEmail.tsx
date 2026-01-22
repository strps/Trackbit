import { Button, Section, Text } from "@react-email/components";
import { BaseEmail } from "./BaseEmail";

interface VerificationEmailProps {
    url: string;
    userName?: string;
}

const frontendBase = process.env.FRONT_URL

export const VerificationEmail = ({ url, userName = "User" }: VerificationEmailProps) => {



    const verificationUrl = new URL(url);
    verificationUrl.searchParams.delete("callbackURL");
    const cleanUrl = verificationUrl.toString();
    // Append the original backend URL as a query parameter for the frontend to handle verification
    const verificationLink = `${frontendBase}/verify-email?backendUrl=${encodeURIComponent(cleanUrl)}`;

    return (
        <BaseEmail
            previewText="Verify your email to activate your Trackbit account"
            heading="Welcome to Trackbit!"
            footer="If you didn't create an account, you can safely ignore this email."
        >
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
        </BaseEmail>
    )
}