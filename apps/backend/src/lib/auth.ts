import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins"
import { user } from "../db/schema/app/user.js";
import { account, session, verification } from "../db/schema/app/auth.js";
import { invites } from "../db/schema/app/settings.js";
import { lt, gte, eq } from "drizzle-orm";
import { getOAuthState, APIError } from "better-auth/api";  // Added APIError
import { PasswordResetEmail } from "../emails/PasswordReset.js";
import { VerificationEmail } from "../emails/VerificationEmail.js";
import { sendEmail } from "./email.js";
import { jsx } from "react/jsx-runtime";
import db from "../db/db.js";
import { t, negotiateFromHeader } from "../i18n/index.js";
import { buildVerificationStrings, buildPasswordResetStrings } from "../i18n/email-strings.js";

export const auth = betterAuth({

  baseURL: process.env.SERVER_URL || 'http://localhost:3000',

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user,
      session,
      account,
      verification
    }
  }),



  plugins: [
    admin()
  ],

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
      const locale = (user as any).locale ?? 'en';
      const strings = buildPasswordResetStrings(locale, user.name ?? 'User');
      sendEmail({
        to: user.email,
        subject: t('emails', 'password_reset.subject', locale),
        react: jsx(PasswordResetEmail, { url, strings }),
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      const locale = (user as any).locale ?? 'en';
      const strings = buildVerificationStrings(locale, user.name ?? 'User');
      sendEmail({
        to: user.email,
        subject: t('emails', 'verification.subject', locale),
        react: jsx(VerificationEmail, { url, strings }),
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
      locale: {
        type: "string",
        required: false,
        defaultValue: "en",
        input: true,
      },
      timezone: {
        type: "string",
        required: false,
        defaultValue: "UTC",
        input: true,
      },
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (data, ctx) => {
          const locale = negotiateFromHeader(
            (ctx?.request as Request | undefined)?.headers?.get('accept-language') ?? undefined
          );

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
              message: t('errors', 'invite_code_required', locale),
            });
          }

          const invite = await db.query.invites.findFirst({
            where: eq(invites.code, inviteCode),
          });

          if (!invite) {
            throw new APIError("BAD_REQUEST", {
              message: t('errors', 'invite_code_invalid', locale),
            });
          }

          // Check usage limit
          if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
            throw new APIError("BAD_REQUEST", {
              message: t('errors', 'invite_code_max_uses', locale),
            });
          }

          // Check expiration
          if (invite.expiresAt && invite.expiresAt < new Date()) {
            throw new APIError("BAD_REQUEST", {
              message: t('errors', 'invite_code_expired', locale),
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