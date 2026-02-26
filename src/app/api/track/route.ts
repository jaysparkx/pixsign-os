import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { documentId, visitorId, location, events } = body;

        if (!documentId || !visitorId || !Array.isArray(events) || events.length === 0) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
        const userAgent = req.headers.get("user-agent") || "unknown";

        // Batch insert all view events
        await prisma.viewEvent.createMany({
            data: events.map((e: any) => ({
                documentId,
                visitorId,
                page: e.page,
                durationMs: Math.max(0, Math.round(e.durationMs || 0)),
                scrollDepth: Math.min(1, Math.max(0, e.scrollDepth || 0)),
                ip,
                userAgent,
                location: location || null,
            })),
        });

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("Track error:", e);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
