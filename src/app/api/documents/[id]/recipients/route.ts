import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const r = await prisma.recipient.findMany({ where: { documentId: params.id }, orderBy: { signingOrder: "asc" } });
  return NextResponse.json(r);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { name, email, role, signingOrder } = await req.json();
  if (!name || !email) return NextResponse.json({ error: "Name and email required" }, { status: 400 });

  const exists = await prisma.recipient.findFirst({ where: { documentId: params.id, email: email.toLowerCase() } });
  if (exists) return NextResponse.json({ error: "Already a recipient" }, { status: 400 });

  const count = await prisma.recipient.count({ where: { documentId: params.id } });
  const r = await prisma.recipient.create({
    data: { documentId: params.id, name: name.trim(), email: email.toLowerCase().trim(), role: role || "SIGNER", signingOrder: signingOrder || count + 1 },
  });
  return NextResponse.json(r, { status: 201 });
}
