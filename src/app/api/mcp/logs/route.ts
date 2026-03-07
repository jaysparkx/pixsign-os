import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/get-user";

/**
 * GET /api/mcp/logs — Get recent MCP activity logs for the user
 */
export async function GET() {
    const { user, error } = await requireUser();
    if (error) return error;

    const logs = await prisma.mcpLog.findMany({
        where: { apiKey: { userId: user.id } },
        select: {
            id: true,
            tool: true,
            status: true,
            durationMs: true,
            error: true,
            createdAt: true,
            apiKey: { select: { name: true, keyPrefix: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
    });

    return NextResponse.json(logs);
}
