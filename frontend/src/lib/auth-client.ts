import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
    baseURL: "http://localhost:3000" // Your Fastify Backend URL
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

