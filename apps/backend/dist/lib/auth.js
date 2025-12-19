"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = void 0;
const better_auth_1 = require("better-auth");
const drizzle_1 = require("better-auth/adapters/drizzle");
const user_1 = require("../db/schema/user");
const auth_1 = require("../db/schema/auth");
const invites_1 = require("../db/schema/invites");
const drizzle_orm_1 = require("drizzle-orm");
const api_1 = require("better-auth/api");
const PasswordReset_1 = require("../emails/PasswordReset");
const VerificationEmail_1 = require("../emails/VerificationEmail");
const email_1 = require("./email");
const jsx_runtime_1 = require("react/jsx-runtime");
const db_1 = __importDefault(require("../db/db"));
exports.auth = (0, better_auth_1.betterAuth)({
    database: (0, drizzle_1.drizzleAdapter)(db_1.default, {
        provider: "pg",
        schema: {
            user: user_1.user,
            session: auth_1.session,
            account: auth_1.account,
            verification: auth_1.verification
        }
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
        async sendResetPassword({ user, url }) {
            (0, email_1.sendEmail)({
                to: user.email,
                subject: "Reset your Trackbit password",
                react: (0, jsx_runtime_1.jsx)(PasswordReset_1.PasswordResetEmail, { url, userName: user.name ?? undefined }),
            });
        },
    },
    emailVerification: {
        sendOnSignUp: true, // Send verification immediately after sign-up
        sendVerificationEmail: async ({ user, url }) => {
            (0, email_1.sendEmail)({
                to: user.email,
                subject: "Verify your Trackbit account",
                react: (0, jsx_runtime_1.jsx)(VerificationEmail_1.VerificationEmail, { url, userName: user.name ?? undefined }),
            });
        },
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
        github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
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
                    let inviteCode;
                    // For email/password signup: inviteCode comes directly from data
                    if ("inviteCode" in data) {
                        inviteCode = data.inviteCode;
                        delete data.inviteCode;
                    }
                    // For social/OAuth signup: retrieve from state during callback
                    if (ctx?.path?.startsWith("/callback/")) { // Detect OAuth callback route
                        const stateData = await (0, api_1.getOAuthState)();
                        inviteCode = stateData?.inviteCode ?? inviteCode; // Override or fallback
                    }
                    // Require an invite code for all new signups
                    if (!inviteCode) {
                        throw new Error("An invitation code is required to create an account.");
                    }
                    console.log("inviteCode", inviteCode);
                    // Build dynamic conditions for finding a valid invite
                    const conditions = [(0, drizzle_orm_1.eq)(invites_1.invites.code, inviteCode)];
                    // Optional: limit by maxUses (only apply if maxUses is set)
                    // We separately fetch the invite first to access its values
                    const invite = await db_1.default.query.invites.findFirst({
                        where: (0, drizzle_orm_1.eq)(invites_1.invites.code, inviteCode),
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
                    await db_1.default
                        .update(invites_1.invites)
                        .set({
                        uses: newUses,
                        consumedAt: isFullyConsumed ? new Date() : null,
                    })
                        .where((0, drizzle_orm_1.eq)(invites_1.invites.id, invite.id));
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
//# sourceMappingURL=auth.js.map