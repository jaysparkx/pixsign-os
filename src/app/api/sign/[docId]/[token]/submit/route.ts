import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { finalizeDocument } from "@/lib/pdf";
import { sendSigningRequest, sendCompletionEmail } from "@/lib/email";
import { log, getIp } from "@/lib/events";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { docId: string; token: string } }) {
  const recipient = await prisma.recipient.findUnique({ where: { token: params.token } });
  if (!recipient || recipient.documentId !== params.docId) {
    return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  }
  if (recipient.status === "SIGNED") return NextResponse.json({ error: "Already signed" }, { status: 400 });

  const { fields, consent } = await req.json();
  if (!consent) return NextResponse.json({ error: "Consent required" }, { status: 400 });

  const ip = getIp(req);

  // Save each field value
  console.log(`[SUBMIT] Recipient: ${recipient.id}, fields received:`, (fields as any[]).length);
  for (const f of fields as Array<{ id: string; value?: string; sigDataUrl?: string }>) {
    const field = await prisma.field.findUnique({ where: { id: f.id } });
    if (!field || (field.recipientId !== null && field.recipientId !== recipient.id)) {
      console.log(`[SUBMIT] SKIPPED field ${f.id}: not found or wrong recipient (fieldRecipientId=${field?.recipientId}, recipientId=${recipient.id})`);
      continue;
    }

    const value = (field.type === "SIGNATURE" || field.type === "INITIALS") ? f.sigDataUrl : f.value;
    console.log(`[SUBMIT] Saving field ${f.id} type=${field.type} hasValue=${!!value} valueLen=${value?.length}`);
    if (field.required && !value) {
      return NextResponse.json({ error: `Required field missing: ${field.type}` }, { status: 400 });
    }

    await prisma.field.update({ where: { id: f.id }, data: { value: value || null, signedAt: new Date() } });
    await log(params.docId, "FIELD_SIGNED", recipient.id, ip, { fieldType: field.type });
  }

  // Mark recipient signed
  await prisma.recipient.update({
    where: { id: recipient.id },
    data: { status: "SIGNED", signedAt: new Date(), ipAddress: ip },
  });
  await log(params.docId, "RECIPIENT_SIGNED", recipient.id, ip);

  // Check if all signers done
  const doc = await prisma.document.findUnique({
    where: { id: params.docId },
    include: { recipients: true },
  });
  if (!doc) return NextResponse.json({ ok: true });

  const signers = doc.recipients.filter((r) => r.role === "SIGNER");
  const allSigned = signers.every((r) => r.id === recipient.id ? true : r.status === "SIGNED");

  if (allSigned) {
    const APP = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Finalize PDF — only send completion emails if finalization succeeds
    try {
      await finalizeDocument(params.docId);

      // Send completion emails with per-recipient token-based download URLs
      for (const r of doc.recipients) {
        try {
          const dlUrl = `${APP}/api/sign/${params.docId}/${r.token}?pdf=1&dl=1`;
          await sendCompletionEmail({ to: r.email, toName: r.name, docTitle: doc.title, downloadUrl: dlUrl });
        } catch (e) { console.error("Completion email failed:", e); }
      }
    } catch (e) {
      console.error("Finalization error:", e);
    }

    // Return token-based download URL for the current signer
    const signerDlUrl = `${APP}/api/sign/${params.docId}/${params.token}?pdf=1&dl=1`;
    return NextResponse.json({ ok: true, completed: true, downloadUrl: signerDlUrl });
  } else if (doc.signingOrder === "SEQUENTIAL") {
    // Notify next signer
    const next = signers
      .filter((r) => r.status === "PENDING" || r.status === "SENT")
      .sort((a, b) => a.signingOrder - b.signingOrder)[0];
    if (next) {
      const APP = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      try {
        await sendSigningRequest({
          to: next.email, toName: next.name, senderName: doc.senderName,
          docTitle: doc.title, signingUrl: `${APP}/sign/${doc.id}/${next.token}`,
        });
        await prisma.recipient.update({ where: { id: next.id }, data: { status: "SENT", emailSentAt: new Date() } });
      } catch (e) { console.error("Next signer email failed:", e); }
    }
    // Mark partially signed
    await prisma.document.update({ where: { id: params.docId }, data: { status: "PARTIALLY_SIGNED" } });
  } else {
    await prisma.document.update({ where: { id: params.docId }, data: { status: "PARTIALLY_SIGNED" } });
  }

  return NextResponse.json({ ok: true, completed: false });
}
