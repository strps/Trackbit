import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async ({
    to,
    subject,
    react,
    text,
}: {
    to: string | string[];
    subject: string;
    react?: React.ReactElement;
    text?: string;
}) => {
    if (!process.env.RESEND_API_KEY) {
        console.warn("Resend API key not configured – skipping email send");
        return { success: false, error: "No API key" };
    }
    try {
        const data = await resend.emails.send({
            from: process.env.EMAIL_FROM || "Trackbit <noreply@resend.dev>",
            to: Array.isArray(to) ? to : [to],
            subject,
            react,
            text,
        });
        return { success: true, data };
    } catch (error) {
        console.error("Failed to send email:", error);
        return { success: false, error };
    }
};