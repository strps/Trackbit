import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    baseURL: "http://localhost:3000", // Your Fastify Backend URL
    plugins: [
        inferAdditionalFields({
            user: {
                role: {
                    type: "string" as const,
                    required: false,
                },
                inviteCode: {
                    type: "string" as const,
                    required: false,     // It's optional in type, but we'll enforce required on the form
                    input: true,         // Critical: allows passing during signup
                },
            },

        })
    ]
})

// Convenience exports for your React components
export const {
    signIn,
    signUp,
    signOut,
    useSession,
    requestPasswordReset,
    resetPassword
} = authClient

