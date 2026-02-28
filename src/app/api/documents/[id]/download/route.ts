import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { downloadFile } from "@/lib/storage";
import { log, getIp } from "@/lib/events";
import { requireUser } from "@/lib/get-user";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const doc = await prisma.document.findUnique({ where: { id: params.id, userId: user.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filePath = doc.signedPath || doc.originalPath;
  let buffer: Buffer;
  try {
    buffer = await downloadFile(filePath);
  } catch (e) {
    console.error("Download file error:", e);
    return NextResponse.json({ error: "Failed to retrieve file" }, { status: 500 });
  }
  const filename = `${doc.title.replace(/[^a-z0-9]/gi, "_")}_${doc.status === "COMPLETED" ? "signed" : "original"}.pdf`;

  await log(params.id, "DOWNLOAD", undefined, getIp(req)).catch(() => {});

  const disposition = req.nextUrl.searchParams.get("dl") === "1" ? "attachment" : "inline";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
