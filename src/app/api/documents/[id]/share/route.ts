import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { downloadFile } from "@/lib/storage";

export const runtime = "nodejs";

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

        // Serve PDF binary when ?pdf=1
        if (_.nextUrl.searchParams.get("pdf") === "1") {
            const filePath = doc.signedPath || doc.originalPath;
            const buffer = await downloadFile(filePath);
            return new NextResponse(new Uint8Array(buffer), {
                headers: { "Content-Type": "application/pdf", "Cache-Control": "public, max-age=300" },
            });
        }

        const pdfUrl = `/api/documents/${params.id}/share?pdf=1`;
        return NextResponse.json({ ...doc, pdfUrl });
    } catch (e) {
        console.error("Share API error:", e);
        return NextResponse.json({ error: "Failed to load document" }, { status: 500 });
    }
}
