"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const resend_1 = require("resend");
const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
const sendEmail = async ({ to, subject, react, text, }) => {
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
    }
    catch (error) {
        console.error("Failed to send email:", error);
        return { success: false, error };
    }
};
exports.sendEmail = sendEmail;
//# sourceMappingURL=email.js.map