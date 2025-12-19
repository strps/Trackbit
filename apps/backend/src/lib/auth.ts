import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { user } from "../db/schema/user";
import { account, session, verification } from "../db/schema/auth";
import { invites } from "../db/schema/invites";
import { lt, gte, eq } from "drizzle-orm";
import { getOAuthState } from "better-auth/api";
import { PasswordResetEmail } from "../emails/PasswordReset"
import { VerificationEmail } from "../emails/VerificationEmail"
import { sendEmail } from "./email";
import { jsx } from "react/jsx-runtime";
import db from "../db/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user,
      session,
      account,
      verification
    }
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    async sendResetPassword({ user, url }) {
      sendEmail({
        to: user.email,
        subject: "Reset your Trackbit password",
        react: jsx(PasswordResetEmail, { url, userName: user.name ?? undefined }),
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true, // Send verification immediately after sign-up
    sendVerificationEmail: async ({ user, url }) => {
      sendEmail({
        to: user.email,
        subject: "Verify your Trackbit account",
        react: jsx(VerificationEmail, { url, userName: user.name ?? undefined }),
      });
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },

  // baseURL: "api/auth",
  basePath: "/api/auth",

  // Allow cross-origin requests from your Frontend
  trustedOrigins: process.env.TRUSTED_ORIGINS?.split(',') || ["http://localhost:5173"],

  user: {
    additionalFields: {
      inviteCode: {
        type: "string",
        required: false,
        input: true, // Allow passing during signups
      },
      // Ensure role is defined here if not already
      role: {
        type: "string",
        required: false,
        defaultValue: "tester",
        input: false,
      },
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (data, ctx) => {


          let inviteCode: string | undefined;

          // For email/password signup: inviteCode comes directly from data
          if ("inviteCode" in data) {
            inviteCode = (data as { inviteCode?: string }).inviteCode;
            delete data.inviteCode;
          }

          // For social/OAuth signup: retrieve from state during callback
          if (ctx?.path?.startsWith("/callback/")) {  // Detect OAuth callback route
            const stateData = await getOAuthState();
            inviteCode = stateData?.inviteCode ?? inviteCode;  // Override or fallback
          }

          // Require an invite code for all new signups
          if (!inviteCode) {
            throw new Error("An invitation code is required to create an account.");
          }



          console.log("inviteCode", inviteCode);

          // Build dynamic conditions for finding a valid invite
          const conditions = [eq(invites.code, inviteCode)];

          // Optional: limit by maxUses (only apply if maxUses is set)
          // We separately fetch the invite first to access its values
          const invite = await db.query.invites.findFirst({
            where: eq(invites.code, inviteCode),
          });

          if (!invite) {
            throw new Error("Invalid invitation code.");
          }

          // Check usage limit
          if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
            throw new Error("This invitation code has reached its maximum uses.");
          }

          // Check expiration
          if (invite.expiresAt && invite.expiresAt < new Date()) {
            throw new Error("This invitation code has expired.");
          }

          // Consume one use of the invite
          const newUses = invite.uses + 1;
          const isFullyConsumed = invite.maxUses !== null && newUses >= invite.maxUses;

          await db
            .update(invites)
            .set({
              uses: newUses,
              consumedAt: isFullyConsumed ? new Date() : null,
            })
            .where(eq(invites.id, invite.id));

          // Assign role from the invite (defaults to 'tester' if not specified)
          return {
            data: {
              ...data,
              role: invite.role ?? "tester",
            },
          };
        },
      },
    },
  },

});