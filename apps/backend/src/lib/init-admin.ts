import { auth } from "./auth";
import db from "../db/db";

export async function initAdmin() {
    // 1. Check if any user exists
    const users = await auth.api.listUsers({
        query: { limit: 1 }
    });

    // 2. If no users found, create the first admin
    if (users.total === 0) {
        console.log("No users found. Creating initial admin...");

        await auth.api.createUser({
            body: {
                email: process.env.INITIAL_ADMIN_EMAIL!,
                password: process.env.INITIAL_ADMIN_PASSWORD!,
                name: "System Admin",
                role: "admin", // Requires the Admin plugin
            }
        });

        console.log("Initial admin created successfully.");
    }
}