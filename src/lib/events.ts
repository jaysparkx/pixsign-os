import prisma from "./prisma";

export async function log(documentId: string, type: string, recipientId?: string, ip?: string, meta?: object) {
  return prisma.event.create({
    data: {
      documentId,
      recipientId: recipientId || null,
      type,
      ip: ip || null,
      meta: meta ? JSON.stringify(meta) : null,
    },
  });
}

export function getIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}
