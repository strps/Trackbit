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
                unitSystem: {
                    type: "string" as const,
                    required: false,
                },
                exerciseLogCardStyle: {
                    type: "string" as const,
                    required: false,
                },
                preferredExerciseSource: {
                    type: "string" as const,
                    required: false,
                },
                // NOT NULL with a default in the database, so always on the
                // session; never set at signup.
                defaultRestSeconds: {
                    type: "number" as const,
                    required: true,
                    input: false,
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

