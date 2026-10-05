import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, bearer } from "better-auth/plugins"
import { user } from "../db/schema/app/user.js";
import { account, session, verification } from "../db/schema/app/auth.js";
import { invites } from "../db/schema/app/settings.js";
import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { getOAuthState, APIError } from "better-auth/api";  // Added APIError
import { PasswordResetEmail } from "../emails/PasswordReset.js";
import { VerificationEmail } from "../emails/VerificationEmail.js";
import { sendEmail } from "./email.js";
import { jsx } from "react/jsx-runtime";
import db from "../db/db.js";
import { t, negotiateFromHeader, SUPPORTED_LOCALES } from "../i18n/index.js";
import { buildVerificationStrings, buildPasswordResetStrings } from "../i18n/email-strings.js";
import { timezoneSchema } from "./user-day.js";

// `timezone` is client-writable (signup, update-user) and decides what "today" is
// for every tracker write, so it must be a real IANA zone.
function assertValidTimezone(data: Record<string, unknown>) {
  if ("timezone" in data && data.timezone !== undefined && !timezoneSchema.safeParse(data.timezone).success) {
    throw new APIError("BAD_REQUEST", { message: "Invalid timezone" });
  }
}

// `locale` is client-writable too, and every client branches on it: only the
// languages the apps ship.
function assertValidLocale(data: Record<string, unknown>) {
  if ("locale" in data && data.locale !== undefined && !(SUPPORTED_LOCALES as readonly unknown[]).includes(data.locale)) {
    throw new APIError("BAD_REQUEST", { message: "Invalid locale" });
  }
}

const USER_NAME_MAX = 100;

// Names are shown wherever the user is: stored trimmed and never blank.
function withValidName<T extends Record<string, unknown>>(data: T): T {
  if (!("name" in data) || data.name === undefined) return data;
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (name.length < 1 || name.length > USER_NAME_MAX) {
    throw new APIError("BAD_REQUEST", { message: "Invalid name" });
  }
  return { ...data, name };
}

const FRONT_URL = process.env.FRONT_URL || 'http://localhost:5173';

// The reset page lives in the web app, whichever client asked: the emailed link
// carries the token straight to it (Better-Auth's own GET /reset-password/:token
// hop needs a client-supplied `redirectTo`, which no client sent, so every link
// ended on its error page).
export function passwordResetUrl(token: string) {
  return `${FRONT_URL}/reset-password?token=${encodeURIComponent(token)}`;
}

type InviteError = 'invite_code_invalid' | 'invite_code_max_uses' | 'invite_code_expired';

// Clients branch on `code`; better-call would otherwise derive it from the
// (translated) message.
function inviteError(key: InviteError, locale: string) {
  return new APIError("BAD_REQUEST", { message: t('errors', key, locale), code: key.toUpperCase() });
}

/**
 * Consumes one use of [code] and returns the role it grants. The check and the
 * increment are one conditional UPDATE, so concurrent sign-ups can't share the
 * last use; when nothing matched, the row says why.
 */
async function consumeInvite(code: string, locale: string): Promise<string> {
  const now = new Date();
  const [consumed] = await db
    .update(invites)
    .set({
      uses: sql`${invites.uses} + 1`,
      consumedAt: sql`CASE WHEN ${invites.uses} + 1 >= ${invites.maxUses} THEN now() ELSE NULL END`,
    })
    .where(and(
      eq(invites.code, code),
      lt(invites.uses, invites.maxUses),
      or(isNull(invites.expiresAt), gt(invites.expiresAt, now)),
    ))
    .returning({ role: invites.role });
  if (consumed) return consumed.role;

  const invite = await db.query.invites.findFirst({ where: eq(invites.code, code) });
  if (!invite) throw inviteError('invite_code_invalid', locale);
  if (invite.uses >= invite.maxUses) throw inviteError('invite_code_max_uses', locale);
  throw inviteError('invite_code_expired', locale);
}

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
    admin(),
    bearer({ requireSignature: true }),
  ],

  // Trusted origins for cross-site requests
  trustedOrigins: [FRONT_URL, process.env.ADMIN_URL || 'http://localhost:5173'],
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",  // Critical for cross-site cookie setting/sending
      secure: true,      // Required for SameSite=None and HTTPS (Vercel always uses HTTPS)
    },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    // A reset is how a user takes back an account: every signed-in device
    // (bearer tokens too) has to sign in again with the new password.
    revokeSessionsOnPasswordReset: true,
    async sendResetPassword({ user, token }) {
      const url = passwordResetUrl(token);
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
        defaultValue: "user",
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
      // Declared (input: false) so every client gets them typed on the session;
      // they only ever change through PATCH /api/me/preferences.
      unitSystem: {
        type: "string",
        required: false,
        defaultValue: "metric",
        input: false,
      },
      exerciseLogCardStyle: {
        type: "string",
        required: false,
        defaultValue: "classic",
        input: false,
      },
      // Declared so the picker's last-used source rides along on the session
      // instead of costing a separate fetch on boot. Never client-supplied at
      // signup — it only ever changes through PATCH /api/me/preferences.
      preferredExerciseSource: {
        type: "string",
        required: false,
        input: false,
      },
      // The rest timer's length after each set (0 = off); read by the
      // Android app's session screen, changed through PATCH /api/me/preferences.
      defaultRestSeconds: {
        type: "number",
        required: false,
        defaultValue: 90,
        input: false,
      },
    },
  },

  databaseHooks: {
    user: {
      update: {
        before: async (data) => {
          assertValidTimezone(data);
          assertValidLocale(data);
          return { data: withValidName(data) };
        },
      },
      create: {
        before: async (data, ctx) => {
          // For email/password signup: inviteCode comes directly from data. It
          // isn't a column, so it must leave the input object itself: Better-Auth
          // merges the returned data into it, and a key missing from a copy
          // would still reach the insert (every invited sign-up failed so).
          let inviteCode = (data as { inviteCode?: unknown }).inviteCode;
          delete (data as { inviteCode?: unknown }).inviteCode;

          assertValidTimezone(data);
          assertValidLocale(data);
          data = withValidName(data);
          const locale = negotiateFromHeader(
            (ctx?.request as Request | undefined)?.headers?.get('accept-language') ?? undefined
          );

          // For social/OAuth signup: retrieve from state during callback
          if (ctx?.path?.startsWith("/callback/")) {
            const stateData = await getOAuthState();
            inviteCode = stateData?.inviteCode ?? inviteCode;
          }

          // Invite code is optional. Regular signups get the default role.
          // If a code is supplied (e.g. from an emailed invite link), validate
          // it, consume one use, and assign the role from the invite.
          const code = typeof inviteCode === "string" ? inviteCode.trim() : "";
          if (!code) {
            return { data };
          }

          return { data: { ...data, role: await consumeInvite(code, locale) } };
        },
      },
    },
  },
});