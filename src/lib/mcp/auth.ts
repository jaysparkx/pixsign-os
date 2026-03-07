import prisma from "../prisma";
import crypto from "crypto";

/**
 * Hash an API key using SHA-256
 */
export function hashApiKey(key: string): string {
    return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Generate a new API key with prefix
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
    const raw = crypto.randomBytes(32).toString("hex");
    const key = `pk_${raw}`;
    const hash = hashApiKey(key);
    const prefix = `pk_${raw.substring(0, 8)}...`;
    return { key, hash, prefix };
}

/**
 * Validate an API key and return the associated user.
 * Updates lastUsedAt on success.
 */
export async function validateApiKey(key: string): Promise<{ userId: string; apiKeyId: string } | null> {
    const hash = hashApiKey(key);

    const apiKey = await prisma.apiKey.findUnique({
        where: { keyHash: hash },
        select: { id: true, userId: true, revokedAt: true, expiresAt: true },
    });

    if (!apiKey) return null;
    if (apiKey.revokedAt) return null;
    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) return null;

    // Update last used (fire-and-forget)
    prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
    }).catch(() => { });

    return { userId: apiKey.userId, apiKeyId: apiKey.id };
}
