import { BlobNotFoundError, del, head } from '@vercel/blob'
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client'

/** A file in the store, as the store itself reports it (never as a client claims it). */
export interface StoredFile {
    url: string
    bytes: number
    contentType: string
}

/**
 * Where uploaded media lives. Browsers upload straight to it with a short-lived token for one
 * key, so large bodies never pass through the API; the API only signs, checks and deletes.
 */
export interface MediaStore {
    /** A token that lets a browser upload one file to [key], within [rules]. */
    uploadToken(key: string, rules: { contentTypes: readonly string[]; maxBytes: number }): Promise<string>
    /** The file at [key], or null when nothing was uploaded there. */
    head(key: string): Promise<StoredFile | null>
    delete(keys: string[]): Promise<void>
}

/** Vercel Blob, with the project's `BLOB_READ_WRITE_TOKEN`. */
class VercelBlobStore implements MediaStore {
    private get token() {
        const token = process.env.BLOB_READ_WRITE_TOKEN
        if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not set')
        return token
    }

    uploadToken(key: string, rules: { contentTypes: readonly string[]; maxBytes: number }) {
        return generateClientTokenFromReadWriteToken({
            token: this.token,
            pathname: key,
            allowedContentTypes: [...rules.contentTypes],
            maximumSizeInBytes: rules.maxBytes,
            addRandomSuffix: false,
            validUntil: Date.now() + 10 * 60 * 1000,
        })
    }

    async head(key: string): Promise<StoredFile | null> {
        try {
            const blob = await head(key, { token: this.token })
            return { url: blob.url, bytes: blob.size, contentType: blob.contentType }
        } catch (err) {
            if (err instanceof BlobNotFoundError) return null
            throw err
        }
    }

    async delete(keys: string[]) {
        if (keys.length > 0) await del(keys, { token: this.token })
    }
}

export const mediaStore: MediaStore = new VercelBlobStore()
