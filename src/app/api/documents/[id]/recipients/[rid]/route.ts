import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function DELETE(_: NextRequest, { params }: { params: { id: string; rid: string } }) {
  await prisma.field.updateMany({ where: { recipientId: params.rid }, data: { recipientId: null } });
  await prisma.recipient.delete({ where: { id: params.rid } });
  return NextResponse.json({ ok: true });
}
