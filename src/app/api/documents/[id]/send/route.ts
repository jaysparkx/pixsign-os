import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendSigningRequest } from "@/lib/email";
import { log } from "@/lib/events";
import { requireUser } from "@/lib/get-user";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const doc = await prisma.document.findUnique({
    where: { id: params.id, userId: user.id },
    include: { recipients: true, fields: true },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.status !== "DRAFT") return NextResponse.json({ error: "Already sent" }, { status: 400 });

  const signers = doc.recipients.filter((r) => r.role === "SIGNER");
  if (!signers.length) return NextResponse.json({ error: "Add at least one signer" }, { status: 400 });

  // Auto-assign unassigned fields to the first signer
  const unassigned = doc.fields.filter((f) => !f.recipientId);
  if (unassigned.length > 0) {
    const defaultSigner = signers.sort((a, b) => a.signingOrder - b.signingOrder)[0];
    await prisma.field.updateMany({
      where: { id: { in: unassigned.map((f) => f.id) } },
      data: { recipientId: defaultSigner.id },
    });
  }

  const body = await req.json().catch(() => ({}));
  const senderName = body.senderName || doc.senderName || "Document Sender";

  await prisma.document.update({ where: { id: params.id }, data: { status: "SENT", senderName } });
  await log(params.id, "DOCUMENT_SENT");

  const APP = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // PARALLEL: send all at once. SEQUENTIAL: only first.
  const toNotify = doc.signingOrder === "SEQUENTIAL"
    ? [signers.sort((a, b) => a.signingOrder - b.signingOrder)[0]]
    : signers;

  for (const r of toNotify) {
    const signingUrl = `${APP}/sign/${doc.id}/${r.token}`;
    try {
      await sendSigningRequest({
        to: r.email, toName: r.name, senderName,
        docTitle: doc.title, message: doc.message || undefined,
        signingUrl, expiresAt: doc.expiresAt || undefined,
      });
      await prisma.recipient.update({ where: { id: r.id }, data: { status: "SENT", emailSentAt: new Date() } });
      await log(params.id, "EMAIL_SENT", r.id);
    } catch (err) {
      console.error("Email failed:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
