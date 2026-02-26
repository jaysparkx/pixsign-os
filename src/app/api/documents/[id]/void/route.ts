import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { log } from "@/lib/events";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { reason } = await req.json().catch(() => ({}));
  await prisma.document.update({
    where: { id: params.id },
    data: { status: "VOIDED", voidedAt: new Date(), voidReason: reason || "Voided" },
  });
  await log(params.id, "DOCUMENT_VOIDED", undefined, undefined, { reason });
  return NextResponse.json({ ok: true });
}
