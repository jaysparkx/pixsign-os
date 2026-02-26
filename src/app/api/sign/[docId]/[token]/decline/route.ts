import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { log, getIp } from "@/lib/events";

export async function POST(req: NextRequest, { params }: { params: { docId: string; token: string } }) {
  const { reason } = await req.json().catch(() => ({}));
  const r = await prisma.recipient.findUnique({ where: { token: params.token } });
  if (!r) return NextResponse.json({ error: "Invalid" }, { status: 404 });

  await prisma.recipient.update({ where: { id: r.id }, data: { status: "DECLINED", declinedAt: new Date(), declineReason: reason } });
  await prisma.document.update({ where: { id: params.docId }, data: { status: "DECLINED" } });
  await log(params.docId, "RECIPIENT_DECLINED", r.id, getIp(req), { reason });

  return NextResponse.json({ ok: true });
}
