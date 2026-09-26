import { Resend } from "resend";

// The SDK throws on construction without a key, which would stop the server from booting.
// Without one (local dev, tests), emails are skipped instead.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

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
    if (!resend) {
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