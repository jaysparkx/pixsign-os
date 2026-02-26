import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const docs = await prisma.document.findMany({
    include: { recipients: true, _count: { select: { fields: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(docs);
}
