export declare const auth: import("better-auth", { with: { "resolution-mode": "import" } }).Auth<{
    database: (options: import("better-auth", { with: { "resolution-mode": "import" } }).BetterAuthOptions) => import("better-auth", { with: { "resolution-mode": "import" } }).DBAdapter<import("better-auth", { with: { "resolution-mode": "import" } }).BetterAuthOptions>;
    emailAndPassword: {
        enabled: true;
        requireEmailVerification: true;
        sendResetPassword({ user, url }: {
            user: import("better-auth", { with: { "resolution-mode": "import" } }).User;
            url: string;
            token: string;
        }): Promise<void>;
    };
    emailVerification: {
        sendOnSignUp: true;
        sendVerificationEmail: ({ user, url }: {
            user: import("better-auth", { with: { "resolution-mode": "import" } }).User;
            url: string;
            token: string;
        }) => Promise<void>;
    };
    socialProviders: {
        google: {
            clientId: string;
            clientSecret: string;
        };
        github: {
            clientId: string;
            clientSecret: string;
        };
    };
    basePath: string;
    trustedOrigins: string[];
    user: {
        additionalFields: {
            inviteCode: {
                type: "string";
                required: false;
                input: true;
            };
            role: {
                type: "string";
                required: false;
                defaultValue: string;
                input: false;
            };
        };
    };
    databaseHooks: {
        user: {
            create: {
                before: (data: {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    email: string;
                    emailVerified: boolean;
                    name: string;
                    image?: string | null | undefined;
                } & Record<string, unknown>, ctx: import("better-auth", { with: { "resolution-mode": "import" } }).GenericEndpointContext<import("better-auth", { with: { "resolution-mode": "import" } }).BetterAuthOptions> | null) => Promise<{
                    data: {
                        role: string;
                        id: string;
                        createdAt: Date;
                        updatedAt: Date;
                        email: string;
                        emailVerified: boolean;
                        name: string;
                        image?: string | null | undefined;
                    };
                }>;
            };
        };
    };
}>;
//# sourceMappingURL=auth.d.ts.map