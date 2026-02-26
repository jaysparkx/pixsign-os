import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    include: { fields: { include: { recipient: true } }, recipients: true },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(doc);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const doc = await prisma.document.update({
    where: { id: params.id },
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
  await prisma.document.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
