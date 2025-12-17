import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    baseURL: "http://localhost:3000", // Your Fastify Backend URL
    plugins: [
        inferAdditionalFields()
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

