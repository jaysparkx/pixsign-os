import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
    try {
        const doc = await prisma.document.findUnique({
            where: { id: params.id },
            select: {
                id: true,
                title: true,
                originalPath: true,
                signedPath: true,
                status: true,
                createdAt: true,
                expiresAt: true,
            },
        });
        if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json(doc);
    } catch (e) {
        console.error("Share API error:", e);
        return NextResponse.json({ error: "Failed to load document" }, { status: 500 });
    }
}
