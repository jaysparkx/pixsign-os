import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/get-user";
import { generateApiKey, hashApiKey } from "@/lib/mcp/auth";

/**
 * GET /api/mcp/keys — List user's API keys (masked)
 */
export async function GET() {
    const { user, error } = await requireUser();
    if (error) return error;

    const keys = await prisma.apiKey.findMany({
        where: { userId: user.id },
        select: {
            id: true,
            name: true,
            keyPrefix: true,
            lastUsedAt: true,
            expiresAt: true,
            revokedAt: true,
            createdAt: true,
            _count: { select: { mcpLogs: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(keys);
}

/**
 * POST /api/mcp/keys — Create a new API key
 */
export async function POST(req: NextRequest) {
    const { user, error } = await requireUser();
    if (error) return error;

    const body = await req.json().catch(() => ({}));
    const name = body.name || "Default";

    // Limit to 5 active keys per user
    const activeCount = await prisma.apiKey.count({
        where: { userId: user.id, revokedAt: null },
    });
    if (activeCount >= 5) {
        return NextResponse.json(
            { error: "Maximum 5 active API keys allowed" },
            { status: 400 }
        );
    }

    const { key, hash, prefix } = generateApiKey();

    const created = await prisma.apiKey.create({
        data: {
            userId: user.id,
            name,
            keyHash: hash,
            keyPrefix: prefix,
        },
    });

    // Return the full key ONLY on creation
    return NextResponse.json(
        {
            id: created.id,
            name: created.name,
            key, // ⚠️ Only shown once!
            keyPrefix: prefix,
            createdAt: created.createdAt,
        },
        { status: 201 }
    );
}

/**
 * DELETE /api/mcp/keys — Revoke an API key
 */
export async function DELETE(req: NextRequest) {
    const { user, error } = await requireUser();
    if (error) return error;

    const { id } = await req.json().catch(() => ({}));
    if (!id) return NextResponse.json({ error: "Key ID required" }, { status: 400 });

    const key = await prisma.apiKey.findUnique({
        where: { id, userId: user.id },
    });
    if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.apiKey.update({
        where: { id },
        data: { revokedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
}
