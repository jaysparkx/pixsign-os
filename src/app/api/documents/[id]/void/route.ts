import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { log } from "@/lib/events";
import { requireUser } from "@/lib/get-user";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const doc = await prisma.document.findUnique({ where: { id: params.id, userId: user.id }, select: { id: true } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { reason } = await req.json().catch(() => ({}));
  await prisma.document.update({
    where: { id: params.id },
    data: { status: "VOIDED", voidedAt: new Date(), voidReason: reason || "Voided" },
  });
  await log(params.id, "DOCUMENT_VOIDED", undefined, undefined, { reason });
  return NextResponse.json({ ok: true });
}
