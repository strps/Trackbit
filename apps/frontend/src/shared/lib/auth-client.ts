import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    baseURL: `${import.meta.env.VITE_API_URL}/auth`, // Your Fastify Backend URL
    plugins: [
        inferAdditionalFields({
            user: {
                role: {
                    type: "string" as const,
                    required: false,
                },
                inviteCode: {
                    type: "string" as const,
                    required: false,
                    input: true,
                },
                locale: {
                    type: "string" as const,
                    required: false,
                },
                timezone: {
                    type: "string" as const,
                    required: false,
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

