"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationEmail = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const components_1 = require("@react-email/components");
const VerificationEmail = ({ url, userName = "User" }) => {
    const frontendBase = process.env.FRONT_URL;
    const verificationUrl = new URL(url);
    verificationUrl.searchParams.delete("callbackURL");
    const cleanUrl = verificationUrl.toString();
    // Append the original backend URL as a query parameter for the frontend to handle verification
    const verificationLink = `${frontendBase}/verify-email?backendUrl=${encodeURIComponent(cleanUrl)}`;
    return ((0, jsx_runtime_1.jsxs)(components_1.Html, { children: [(0, jsx_runtime_1.jsx)(components_1.Head, {}), (0, jsx_runtime_1.jsx)(components_1.Preview, { children: "Verify your email to activate your Trackbit account" }), (0, jsx_runtime_1.jsx)(components_1.Tailwind, { children: (0, jsx_runtime_1.jsx)("body", { className: "bg-gray-100 font-sans", children: (0, jsx_runtime_1.jsxs)(components_1.Container, { className: "bg-white mx-auto my-8 p-8 rounded-lg shadow-md max-w-lg", children: [(0, jsx_runtime_1.jsx)(components_1.Heading, { className: "text-2xl font-bold text-center text-gray-900", children: "Welcome to Trackbit!" }), (0, jsx_runtime_1.jsxs)(components_1.Section, { className: "mt-6", children: [(0, jsx_runtime_1.jsxs)(components_1.Text, { className: "text-gray-700", children: ["Hello ", userName, ","] }), (0, jsx_runtime_1.jsx)(components_1.Text, { className: "text-gray-700", children: "Thank you for signing up. Click the button below to verify your email address." }), (0, jsx_runtime_1.jsx)(components_1.Section, { className: "text-center my-8", children: (0, jsx_runtime_1.jsx)(components_1.Button, { href: verificationLink, className: "bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium text-lg", children: "Verify Email Address" }) }), (0, jsx_runtime_1.jsxs)(components_1.Text, { className: "text-gray-600 text-sm", children: ["Or copy and paste this link into your browser: ", (0, jsx_runtime_1.jsx)("br", {}), (0, jsx_runtime_1.jsx)("a", { href: verificationLink, className: "text-primary underline", children: verificationLink })] })] }), (0, jsx_runtime_1.jsx)(components_1.Hr, { className: "my-8 border-gray-300" }), (0, jsx_runtime_1.jsx)(components_1.Text, { className: "text-gray-500 text-sm text-center", children: "If you didn't create an account, you can safely ignore this email." })] }) }) })] }));
};
exports.VerificationEmail = VerificationEmail;
//# sourceMappingURL=VerificationEmail.js.map