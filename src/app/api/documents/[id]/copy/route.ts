import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { readFile, saveFile } from "@/lib/storage";
import { log } from "@/lib/events";

export const runtime = "nodejs";

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
    const doc = await prisma.document.findUnique({
        where: { id: params.id },
        include: { fields: true, recipients: true },
    });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Copy the original PDF file
    const buffer = readFile(doc.originalPath);
    const newPath = saveFile(buffer, "originals");

    // Create the new document
    const copy = await prisma.document.create({
        data: {
            title: `${doc.title} (Copy)`,
            originalPath: newPath,
            originalHash: doc.originalHash,
            status: "DRAFT",
        },
    });

    await log(copy.id, "DOCUMENT_CREATED", undefined, undefined, { copiedFrom: doc.id });

    return NextResponse.json({ id: copy.id, title: copy.title });
}
