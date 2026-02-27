import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/get-user";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const [doc, events, viewEvents] = await Promise.all([
    prisma.document.findUnique({
      where: { id: params.id, userId: user.id },
      include: { recipients: true, fields: true },
    }),
    prisma.event.findMany({
      where: { documentId: params.id },
      include: { recipient: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.viewEvent.findMany({
      where: { documentId: params.id },
    }),
  ]);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const signers = doc.recipients.filter((r: any) => r.role === "SIGNER");
  const signed = signers.filter((r: any) => r.status === "SIGNED").length;

  // Aggregate page heatmap data
  const pageMap = new Map<number, { totalMs: number; views: number; maxScroll: number }>();
  const visitorMap = new Map<string, { totalMs: number; pages: Set<number>; views: number; lastSeen: Date; ip: string; userAgent: string; location: string }>();

  for (const ve of viewEvents) {
    // Per-page aggregation
    const existing = pageMap.get(ve.page) || { totalMs: 0, views: 0, maxScroll: 0 };
    existing.totalMs += ve.durationMs;
    existing.views += 1;
    existing.maxScroll = Math.max(existing.maxScroll, ve.scrollDepth);
    pageMap.set(ve.page, existing);

    // Per-visitor aggregation
    const visitor = visitorMap.get(ve.visitorId) || { totalMs: 0, pages: new Set<number>(), views: 0, lastSeen: ve.createdAt, ip: ve.ip || "", userAgent: ve.userAgent || "", location: ve.location || "" };
    visitor.totalMs += ve.durationMs;
    visitor.pages.add(ve.page);
    visitor.views += 1;
    if (new Date(ve.createdAt) > new Date(visitor.lastSeen)) {
      visitor.lastSeen = ve.createdAt;
    }
    if (ve.location && !visitor.location) visitor.location = ve.location;
    visitorMap.set(ve.visitorId, visitor);
  }

  // Build heatmap array
  const maxPageTime = Math.max(...Array.from(pageMap.values()).map(p => p.totalMs), 1);
  const totalPages = Math.max(...Array.from(pageMap.keys()), doc.fields.reduce((m: number, f: any) => Math.max(m, f.page), 0), 1);
  const heatmap = [];
  for (let i = 1; i <= totalPages; i++) {
    const data = pageMap.get(i) || { totalMs: 0, views: 0, maxScroll: 0 };
    heatmap.push({
      page: i,
      avgTimeMs: data.views > 0 ? Math.round(data.totalMs / data.views) : 0,
      totalTimeMs: data.totalMs,
      views: data.views,
      scrollDepth: data.maxScroll,
      intensity: data.totalMs / maxPageTime, // 0-1 normalized for heatmap color
    });
  }

  // Build visitors array
  const visitors = Array.from(visitorMap.entries()).map(([id, v]) => ({
    id,
    totalTimeMs: v.totalMs,
    pagesViewed: v.pages.size,
    totalViews: v.views,
    lastSeen: v.lastSeen,
    ip: v.ip,
    location: v.location || "Unknown",
    device: parseDevice(v.userAgent),
  })).sort((a, b) => b.totalTimeMs - a.totalTimeMs);

  // Build engagement timeline (group by hour)
  const timelineMap = new Map<string, number>();
  for (const ve of viewEvents) {
    const hour = new Date(ve.createdAt).toISOString().slice(0, 13); // "2026-02-26T12"
    timelineMap.set(hour, (timelineMap.get(hour) || 0) + 1);
  }
  const engagementTimeline = Array.from(timelineMap.entries())
    .map(([hour, count]) => ({ hour: hour + ":00:00.000Z", views: count }))
    .sort((a, b) => a.hour.localeCompare(b.hour));

  // Total analytics
  const uniqueVisitors = visitorMap.size;
  const totalViews = viewEvents.length;
  const totalDurationMs = viewEvents.reduce((s: number, ve: any) => s + ve.durationMs, 0);
  const avgDurationMs = totalViews > 0 ? Math.round(totalDurationMs / uniqueVisitors) : 0;
  const completionRate = totalPages > 0 && uniqueVisitors > 0
    ? Math.round((visitors.filter(v => v.pagesViewed >= totalPages).length / uniqueVisitors) * 100)
    : 0;

  return NextResponse.json({
    doc: { id: doc.id, title: doc.title, status: doc.status, createdAt: doc.createdAt, completedAt: doc.completedAt, expiresAt: doc.expiresAt },
    stats: {
      totalSigners: signers.length,
      signedCount: signed,
      completionRate: signers.length ? Math.round((signed / signers.length) * 100) : 0,
      totalFields: doc.fields.length,
      completedFields: doc.fields.filter((f: any) => f.signedAt).length,
      // New analytics stats
      totalViews,
      uniqueVisitors,
      avgDurationMs,
      viewCompletionRate: completionRate,
      totalPages,
    },
    recipients: doc.recipients,
    timeline: events.map((e: any) => ({
      id: e.id, type: e.type, createdAt: e.createdAt,
      recipient: e.recipient ? `${e.recipient.name} <${e.recipient.email}>` : null,
      ip: e.ip,
    })),
    heatmap,
    visitors,
    engagementTimeline,
  });
}

function parseDevice(ua: string): string {
  if (!ua || ua === "unknown") return "Unknown";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return "Other";
}
