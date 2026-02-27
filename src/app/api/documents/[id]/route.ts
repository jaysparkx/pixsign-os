import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getDownloadUrl, deleteFile } from "@/lib/storage";
import { requireUser } from "@/lib/get-user";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const doc = await prisma.document.findUnique({
    where: { id: params.id, userId: user.id },
    include: { fields: { include: { recipient: true } }, recipients: true },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const pdfUrl = await getDownloadUrl(doc.signedPath || doc.originalPath);
  return NextResponse.json({ ...doc, pdfUrl });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await req.json();
  const doc = await prisma.document.update({
    where: { id: params.id, userId: user.id },
    data: {
      ...(body.title && { title: body.title }),
      ...(body.message !== undefined && { message: body.message }),
      ...(body.senderName && { senderName: body.senderName }),
      ...(body.signingOrder && { signingOrder: body.signingOrder }),
      ...(body.expiresAt && { expiresAt: new Date(body.expiresAt) }),
    },
  });
  return NextResponse.json(doc);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const doc = await prisma.document.findUnique({ where: { id: params.id, userId: user.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Clean up R2 files
  if (doc.originalPath) await deleteFile(doc.originalPath).catch(() => {});
  if (doc.signedPath) await deleteFile(doc.signedPath).catch(() => {});

  await prisma.document.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
