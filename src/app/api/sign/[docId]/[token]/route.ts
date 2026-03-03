import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { log, getIp } from "@/lib/events";
import { downloadFile } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { docId: string; token: string } }) {
  const recipient = await prisma.recipient.findUnique({
    where: { token: params.token },
    include: { document: { include: { fields: true } } },
  });

  if (!recipient || recipient.documentId !== params.docId) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  const doc = recipient.document;

  // Serve PDF binary when ?pdf=1
  if (req.nextUrl.searchParams.get("pdf") === "1") {
    const filePath = doc.signedPath || doc.originalPath;
    try {
      const buffer = await downloadFile(filePath);
      const headers: Record<string, string> = {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=300",
      };
      if (req.nextUrl.searchParams.get("dl") === "1") {
        const filename = `${doc.title.replace(/[^a-z0-9]/gi, "_")}_signed.pdf`;
        headers["Content-Disposition"] = `attachment; filename="${filename}"`;
      }
      return new NextResponse(new Uint8Array(buffer), { headers });
    } catch (e) {
      console.error("Sign PDF download error:", e);
      return NextResponse.json({ error: "Failed to retrieve file" }, { status: 500 });
    }
  }

  if (doc.status === "VOIDED") return NextResponse.json({ error: "This document has been voided" }, { status: 410 });
  if (doc.status === "COMPLETED") return NextResponse.json({ completed: true, pdfUrl: `/api/sign/${params.docId}/${params.token}?pdf=1` });
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

  // Return fields assigned to this recipient OR unassigned fields
  const myFields = doc.fields
    .filter((f) => f.recipientId === recipient.id || !f.recipientId)
    .map((f) => ({ id: f.id, page: f.page, x: f.x, y: f.y, width: f.width, height: f.height, type: f.type, label: f.label, required: f.required }));

  return NextResponse.json({
    recipient: { id: recipient.id, name: recipient.name, email: recipient.email },
    document: { id: doc.id, title: doc.title, message: doc.message, pdfUrl: `/api/sign/${params.docId}/${params.token}?pdf=1`, expiresAt: doc.expiresAt },
    fields: myFields,
  });
}
