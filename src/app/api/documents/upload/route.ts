import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { uploadFile, hashBuffer } from "@/lib/storage";
import { validatePdf } from "@/lib/pdf";
import { log } from "@/lib/events";
import { requireUser } from "@/lib/get-user";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.type !== "application/pdf") return NextResponse.json({ error: "PDF only" }, { status: 400 });
  if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: "Max 50MB" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  let pages = 1;
  try {
    const info = await validatePdf(buffer);
    pages = info.pages;
  } catch {
    return NextResponse.json({ error: "Invalid PDF" }, { status: 400 });
  }

  const originalPath = await uploadFile(buffer, file.name, "originals");
  const originalHash = hashBuffer(buffer);
  const title = (form.get("title") as string) || file.name.replace(".pdf", "");

  const doc = await prisma.document.create({
    data: { title, originalPath, originalHash, userId: user.id },
  });

  await log(doc.id, "DOCUMENT_CREATED", undefined, undefined, { pages });

  return NextResponse.json({ id: doc.id, title: doc.title, pages });
}
