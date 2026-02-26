import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const fields = await prisma.field.findMany({
    where: { documentId: params.id },
    include: { recipient: true },
  });
  return NextResponse.json(fields);
}

// Bulk replace all fields
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
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
