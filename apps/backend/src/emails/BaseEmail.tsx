import { Container, Head, Heading, Hr, Html, Preview, Tailwind, Text } from "@react-email/components";
import tailwindConfig from "./tailwind-config.json";
import { ReactNode } from "react";

interface BaseEmailProps {
    previewText: string;
    heading: string;
    children: ReactNode;
    footer?: ReactNode;
}

export const BaseEmail = ({ previewText, heading, children, footer }: BaseEmailProps) => {
    return (
        <Html>
            <Head>
                <style>{`
                    @media only screen and (max-width: 600px) {
                        .responsive-container { padding: 16px !important; }
                    }
                `}</style>
            </Head>
            <Preview>{previewText}</Preview>
            <Tailwind config={tailwindConfig}>
                <body className="bg-gray-100 font-sans p-[32px]">
                    <Container className="bg-white mx-auto my-8 p-8 rounded-lg shadow-md max-w-lg responsive-container">
                        <Heading className="text-2xl font-bold text-center text-gray-900">{heading}</Heading>
                        {children}
                        {footer && (
                            <>
                                <Hr className="my-8 border-gray-300" />
                                <Text className="text-gray-500 text-sm text-center">
                                    {footer}
                                </Text>
                            </>
                        )}
                    </Container>
                </body>
            </Tailwind>
        </Html>
    );
};