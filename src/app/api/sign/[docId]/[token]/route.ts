import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { log, getIp } from "@/lib/events";

export async function GET(req: NextRequest, { params }: { params: { docId: string; token: string } }) {
  const recipient = await prisma.recipient.findUnique({
    where: { token: params.token },
    include: { document: { include: { fields: { where: { recipientId: { not: null } } } } } },
  });

  if (!recipient || recipient.documentId !== params.docId) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  const doc = recipient.document;

  if (doc.status === "VOIDED") return NextResponse.json({ error: "This document has been voided" }, { status: 410 });
  if (doc.status === "COMPLETED") return NextResponse.json({ completed: true, signedPath: doc.signedPath });
  if (doc.expiresAt && new Date() > doc.expiresAt) {
    await prisma.document.update({ where: { id: doc.id }, data: { status: "EXPIRED" } });
    return NextResponse.json({ error: "This document has expired" }, { status: 410 });
  }
  if (recipient.status === "SIGNED") return NextResponse.json({ alreadySigned: true });
  if (recipient.status === "DECLINED") return NextResponse.json({ declined: true });

  const ip = getIp(req);

  // Mark viewed
  if (!recipient.viewedAt) {
    await prisma.recipient.update({ where: { id: recipient.id }, data: { viewedAt: new Date(), status: "VIEWED", ipAddress: ip } });
    await log(doc.id, "RECIPIENT_VIEWED", recipient.id, ip);
  }

  // Only return fields assigned to this recipient
  const myFields = doc.fields
    .filter((f) => f.recipientId === recipient.id)
    .map((f) => ({ id: f.id, page: f.page, x: f.x, y: f.y, width: f.width, height: f.height, type: f.type, label: f.label, required: f.required }));

  return NextResponse.json({
    recipient: { id: recipient.id, name: recipient.name, email: recipient.email },
    document: { id: doc.id, title: doc.title, message: doc.message, pdfUrl: doc.originalPath, expiresAt: doc.expiresAt },
    fields: myFields,
  });
}
