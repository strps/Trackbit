import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import db from "../db/db";
import { user } from "../db/schema/user";
import { account, session, verification } from "../db/schema/auth";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    // Map the Drizzle schema objects so Better-Auth knows where to look
    schema: {
      user,
      session,
      account,
      verification
    }
  }),
  // Enable Email/Password Login
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set true if you setup SMTP later
  },
  // baseURL: "api/auth",
  basePath: "/api/auth",

  // Allow cross-origin requests from your Frontend
  trustedOrigins: process.env.TRUSTED_ORIGINS?.split(','),
});