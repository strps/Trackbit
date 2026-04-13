// api/invites.ts (updated backend API)

import { Hono } from 'hono'
import { requireAdminAuth } from '../../middleware/require-admin-auth.js'
import db from "../../db/db.js"
import { invites } from "../../db/schema/app/settings.js"
import { eq, name, inArray } from "drizzle-orm"
import { sendEmail } from '../../lib/email'
import { TesterInvitationEmail } from '../../emails/TesterInvitation'
import { jsx } from 'react/jsx-runtime'

type AuthEnv = {
    Variables: {
        user: any
    }
}

const app = new Hono<AuthEnv>()

app.use('*', requireAdminAuth)

app.get('/', async (c) => {
    const user = c.get('user')
    try {
        const result = await db.select().from(invites)
        return c.json(result)
    } catch (error) {
        console.error('Error fetching invites:', error)
        return c.json({ error: 'Failed to fetch invites' }, 500)
    }
})

app.post('/', async (c) => {
    const user = c.get('user')

    // Parse multipart form data
    const body = await c.req.parseBody()

    const email = body['email'] as string | undefined
    const role = (body['role'] as string) || 'tester'
    const maxUses = parseInt((body['maxUses'] as string) || '1', 10)
    const file = body['emailListFile']

    const recipients: string[] = []

    // Handle single email input
    if (email && email.trim()) {
        recipients.push(email.trim())
    }

    // Handle file upload (CSV/TXT)
    if (file && file instanceof File) {
        const content = await file.text()
        // Split by newlines or commas and clean up
        const lines = content.split(/[\r\n,]+/)
            .map(line => line.trim())
            .filter(line => line.includes('@'))
        recipients.push(...lines)
    }

    if (recipients.length === 0) {
        return c.json({ error: 'No recipients provided' }, 400)
    }

    // Remove duplicates
    const uniqueRecipients = [...(new Set(recipients))]

    // Generate invite records
    const newInvites = uniqueRecipients.map(recipient => ({
        code: generateInviteCode(),
        email: recipient,
        // invitedBy: user.id, //TODO: uncomend this, we need to set the admin account, for now fro testing purposes 
        role,
        maxUses
    }))

    try {
        const result = await db.insert(invites).values(newInvites).returning()



        // Send emails for invites with an email address
        const emailPromises = result
            .filter(invite => invite.email) // Only send if email is present
            .map(async (invite) => {
                const emailResult = await sendEmail({
                    to: invite.email!,
                    subject: 'Your Trackbit Invitation Code',
                    react: jsx(TesterInvitationEmail, {
                        invitationUrl: `${process.env.FRONT_URL}/signup?invite=true&code=${invite.code}`,
                        name: invite.email!.split('@')[0]
                    }
                    ),
                });
                if (!emailResult.success) {
                    console.error(`Failed to send email to ${invite.email}: ${emailResult.error}`);
                }
                return emailResult;
            });
        await Promise.all(emailPromises); // Wait for all emails to send (non-blocking for response)

        return c.json({ success: true, count: result.length, invites: result }, 201);


    } catch (error) {
        console.error('Error creating invites:', error)
        return c.json({ error: 'Failed to create invites' }, 500)
    }
})

app.delete('/:id', async (c) => {
    const id = parseInt(c.req.param('id'))
    if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400)

    try {
        await db.delete(invites).where(eq(invites.id, id))
        return c.json({ success: true })
    } catch (error) {
        console.error('Error deleting invite:', error)
        return c.json({ error: 'Failed to delete invite' }, 500)
    }
})

app.delete('/', async (c) => {
    try {
        const body = await c.req.json()
        const ids = body.ids as number[]

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return c.json({ error: 'No IDs provided' }, 400)
        }

        await db.delete(invites).where(inArray(invites.id, ids))
        return c.json({ success: true })
    } catch (error) {
        console.error('Error deleting invites:', error)
        return c.json({ error: 'Failed to delete invites' }, 500)
    }
})

function generateInviteCode(length = 10) {
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0,O,1,I to avoid confusion
    let code = "";

    // Crypto.getRandomValues is the most secure source
    const randomBytes = new Uint8Array(length);
    crypto.getRandomValues(randomBytes);

    for (let i = 0; i < length; i++) {
        code += chars[randomBytes[i] % chars.length];
    }

    return code;
}

export default app