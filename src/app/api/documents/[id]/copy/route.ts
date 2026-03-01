import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { downloadFile, uploadFile } from "@/lib/storage";
import { log } from "@/lib/events";
import { requireUser } from "@/lib/get-user";

export const runtime = "nodejs";

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const doc = await prisma.document.findUnique({
    where: { id: params.id, userId: user.id },
    include: { fields: true, recipients: true },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Copy the original PDF file
  const buffer = await downloadFile(doc.originalPath);
  const newPath = await uploadFile(buffer, "copy.pdf", "originals");

  // Create the new document (owned by same user)
  const copy = await prisma.document.create({
    data: {
      title: `${doc.title} (Copy)`,
      originalPath: newPath,
      originalHash: doc.originalHash,
      status: "DRAFT",
      userId: user.id,
    },
  });

  await log(copy.id, "DOCUMENT_CREATED", undefined, undefined, { copiedFrom: doc.id });

  return NextResponse.json({ id: copy.id, title: copy.title });
}
