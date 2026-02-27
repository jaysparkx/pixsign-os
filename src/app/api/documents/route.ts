import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/get-user";

export async function GET(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const docs = await prisma.document.findMany({
    where: { userId: user.id },
    include: { recipients: true, _count: { select: { fields: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(docs);
}
