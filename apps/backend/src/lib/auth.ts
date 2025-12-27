import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { user } from "../db/schema/user.js";
import { account, session, verification } from "../db/schema/auth.js";
import { invites } from "../db/schema/invites.js";
import { lt, gte, eq } from "drizzle-orm";
import { getOAuthState, APIError } from "better-auth/api";  // Added APIError
import { PasswordResetEmail } from "../emails/PasswordReset.js";
import { VerificationEmail } from "../emails/VerificationEmail.js";
import { sendEmail } from "./email.js";
import { jsx } from "react/jsx-runtime";
import db from "../db/db.js";

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


  // Trusted origins for cross-site requests
  trustedOrigins: process.env.ALLOWED_ORIGINS?.split(','),
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",  // Critical for cross-site cookie setting/sending
      secure: true,      // Required for SameSite=None and HTTPS (Vercel always uses HTTPS)
    },
  },


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
    sendOnSignUp: true,
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

  basePath: "/api/auth",

  user: {
    additionalFields: {
      inviteCode: {
        type: "string",
        required: false,
        input: true,
      },
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
          if (ctx?.path?.startsWith("/callback/")) {
            const stateData = await getOAuthState();
            inviteCode = stateData?.inviteCode ?? inviteCode;
          }

          // Require an invite code for all new signups
          if (!inviteCode) {
            throw new APIError("BAD_REQUEST", {
              message: "An invitation code is required to create an account.",
            });
          }

          console.log("inviteCode", inviteCode);

          const invite = await db.query.invites.findFirst({
            where: eq(invites.code, inviteCode),
          });

          if (!invite) {
            throw new APIError("BAD_REQUEST", {
              message: "Invalid invitation code.",
            });
          }

          // Check usage limit
          if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
            throw new APIError("BAD_REQUEST", {
              message: "This invitation code has reached its maximum uses.",
            });
          }

          // Check expiration
          if (invite.expiresAt && invite.expiresAt < new Date()) {
            throw new APIError("BAD_REQUEST", {
              message: "This invitation code has expired.",
            });
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