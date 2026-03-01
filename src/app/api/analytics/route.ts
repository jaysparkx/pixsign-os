import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/get-user";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  try {
    const [documents, events] = await Promise.all([
      prisma.document.findMany({
        where: { userId: user.id },
        include: { recipients: true, fields: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.event.findMany({
        where: { document: { userId: user.id } },
        include: { recipient: true, document: { select: { title: true } } },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const doc of documents) {
      statusCounts[doc.status] = (statusCounts[doc.status] || 0) + 1;
    }

    const allSigners = documents.flatMap((d) =>
      d.recipients.filter((r) => r.role === "SIGNER")
    );
    const signedSigners = allSigners.filter((r) => r.status === "SIGNED");

    return NextResponse.json({
      documents: documents.map((d) => {
        const docSigners = d.recipients.filter((r) => r.role === "SIGNER");
        const docSigned = docSigners.filter((r) => r.status === "SIGNED").length;
        return { id: d.id, title: d.title, status: d.status, createdAt: d.createdAt, signers: docSigners.length, signed: docSigned };
      }),
      stats: {
        totalDocuments: documents.length,
        completed: statusCounts["COMPLETED"] || 0,
        pending:
          (statusCounts["SENT"] || 0) +
          (statusCounts["PARTIALLY_SIGNED"] || 0),
        drafts: statusCounts["DRAFT"] || 0,
        totalSigners: allSigners.length,
        signedSigners: signedSigners.length,
        completionRate: allSigners.length
          ? Math.round((signedSigners.length / allSigners.length) * 100)
          : 0,
        totalFields: documents.reduce((s, d) => s + d.fields.length, 0),
        completedFields: documents.reduce(
          (s, d) => s + d.fields.filter((f) => f.signedAt).length,
          0
        ),
      },
      statusCounts,
      timeline: events.map((e) => ({
        id: e.id,
        type: e.type,
        createdAt: e.createdAt,
        docTitle: e.document?.title || null,
        recipient: e.recipient
          ? `${e.recipient.name} <${e.recipient.email}>`
          : null,
        ip: e.ip,
      })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
