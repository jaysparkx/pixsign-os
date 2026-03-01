import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/get-user";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const doc = await prisma.document.findUnique({ where: { id: params.id, userId: user.id }, select: { id: true } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fields = await prisma.field.findMany({
    where: { documentId: params.id },
    include: { recipient: true },
  });
  return NextResponse.json(fields);
}

// Bulk replace all fields
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const doc = await prisma.document.findUnique({ where: { id: params.id, userId: user.id }, select: { id: true } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { fields } = await req.json();
  await prisma.field.deleteMany({ where: { documentId: params.id } });
  if (fields?.length) {
    await prisma.field.createMany({
      data: fields.map((f: any) => ({
        documentId: params.id,
        recipientId: f.recipientId || null,
        page: f.page, x: f.x, y: f.y, width: f.width, height: f.height,
        type: f.type, label: f.label || null, required: f.required !== false,
      })),
    });
  }
  const saved = await prisma.field.findMany({ where: { documentId: params.id }, include: { recipient: true } });
  return NextResponse.json(saved);
}
