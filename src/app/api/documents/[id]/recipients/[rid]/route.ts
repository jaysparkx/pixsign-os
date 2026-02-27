import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/get-user";

export async function DELETE(_: NextRequest, { params }: { params: { id: string; rid: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const doc = await prisma.document.findUnique({ where: { id: params.id, userId: user.id }, select: { id: true } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.field.updateMany({ where: { recipientId: params.rid }, data: { recipientId: null } });
  await prisma.recipient.delete({ where: { id: params.rid } });
  return NextResponse.json({ ok: true });
}
