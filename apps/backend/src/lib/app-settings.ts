import db from "../db/db.js";
import { appSettings } from "../db/schema/app/settings.js";

const SECURE_DEFAULTS = {
    googleLoginEnabled: false,
    githubLoginEnabled: false,
    passwordLoginEnabled: true,
} as const;

export async function getOrCreateAppSettings() {
    const [existing] = await db.select().from(appSettings).limit(1);
    if (existing) return existing;

    const [created] = await db
        .insert(appSettings)
        .values(SECURE_DEFAULTS)
        .onConflictDoNothing()
        .returning();

    if (created) return created;

    const [racedRow] = await db.select().from(appSettings).limit(1);
    return racedRow!;
}
