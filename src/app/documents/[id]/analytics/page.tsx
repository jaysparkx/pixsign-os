"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, Users, CheckCircle2, Activity, Eye, Clock, BarChart3, Flame, Monitor, Globe, MapPin } from "lucide-react";
import toast from "react-hot-toast";

const EV: Record<string, { label: string; color: string }> = {
  DOCUMENT_CREATED: { label: "Created", color: "text-slate-500 dark:text-neutral-400" },
  DOCUMENT_SENT: { label: "Sent", color: "text-blue-600 dark:text-blue-400" },
  DOCUMENT_VOIDED: { label: "Voided", color: "text-red-500 dark:text-red-400" },
  DOCUMENT_COMPLETED: { label: "Completed", color: "text-green-600 dark:text-green-400" },
  EMAIL_SENT: { label: "Email Sent", color: "text-blue-600 dark:text-blue-400" },
  RECIPIENT_VIEWED: { label: "Viewed by recipient", color: "text-amber-400" },
  RECIPIENT_SIGNED: { label: "Signed", color: "text-green-600 dark:text-green-400" },
  RECIPIENT_DECLINED: { label: "Declined", color: "text-red-500 dark:text-red-400" },
  FIELD_SIGNED: { label: "Field completed", color: "text-green-500 dark:text-green-300" },
  DOWNLOAD: { label: "Downloaded", color: "text-slate-600 dark:text-neutral-300" },
};

function formatDuration(ms: number): string {
  if (ms < 1000) return "< 1s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function intensityColor(intensity: number): string {
  if (intensity > 0.75) return "bg-rose-500";
  if (intensity > 0.5) return "bg-amber-500";
  if (intensity > 0.25) return "bg-blue-500";
  if (intensity > 0) return "bg-blue-300 dark:bg-blue-800";
  return "bg-slate-200 dark:bg-neutral-800";
}

function intensityBg(intensity: number): string {
  if (intensity > 0.75) return "bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30";
  if (intensity > 0.5) return "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30";
  if (intensity > 0.25) return "bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30";
  if (intensity > 0) return "bg-blue-50/50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-500/20";
  return "bg-slate-100/50 border-slate-200/50 dark:bg-neutral-800/50 dark:border-neutral-700/50";
}

export default function Analytics() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<"overview" | "heatmap" | "visitors" | "activity">("overview");

  useEffect(() => {
    fetch(`/api/documents/${id}/analytics`).then(r => r.json()).then(setData).catch(() => toast.error("Failed"));
  }, [id]);

  if (!data) return <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-mint-500 border-t-transparent rounded-full animate-spin" /></div>;

  const hasViewData = data.stats.totalViews > 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950">
      <header className="border-b border-slate-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href={`/documents/${id}`} className="text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200"><ArrowLeft size={20} /></Link>
          <div className="flex-1">
            <h1 className="font-bold text-slate-800 dark:text-white">{data.doc.title}</h1>
            <div className="text-xs text-slate-500 dark:text-neutral-400">Analytics</div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Views", value: data.stats.totalViews, icon: Eye, color: "text-blue-600 dark:text-blue-400" },
            { label: "Unique Visitors", value: data.stats.uniqueVisitors, icon: Users, color: "text-mint-500" },
            { label: "Avg. Time", value: formatDuration(data.stats.avgDurationMs), icon: Clock, color: "text-amber-400" },
            { label: "Signing Rate", value: `${data.stats.completionRate}%`, icon: CheckCircle2, color: "text-green-600 dark:text-green-400", sub: `${data.stats.signedCount}/${data.stats.totalSigners}` },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <s.icon size={14} className={s.color} />
                <span className="text-xs text-slate-500 dark:text-neutral-400">{s.label}</span>
              </div>
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              {s.sub && <div className="text-xs text-slate-400 dark:text-neutral-500 mt-0.5">{s.sub}</div>}
            </motion.div>
          ))}
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 bg-slate-100 border border-slate-200 dark:bg-neutral-900 dark:border-neutral-800 rounded-lg p-1">
          {[
            { key: "overview" as const, label: "Overview", icon: BarChart3 },
            { key: "heatmap" as const, label: "Page Heatmap", icon: Flame },
            { key: "activity" as const, label: "Activity", icon: Activity },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${tab === t.key ? "bg-white text-slate-800 shadow-sm dark:bg-neutral-800 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-300"}`}>
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Engagement Timeline */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl p-5">
                <h2 className="font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-mint-500" /> Engagement Over Time</h2>
                {data.engagementTimeline.length > 0 ? (
                  <div className="space-y-2">
                    {data.engagementTimeline.map((point: any, i: number) => {
                      const maxViews = Math.max(...data.engagementTimeline.map((p: any) => p.views), 1);
                      const pct = (point.views / maxViews) * 100;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 dark:text-neutral-400 w-20 flex-shrink-0 font-mono">
                            {new Date(point.hour).toLocaleDateString("en-US", { month: "short", day: "numeric" })} {new Date(point.hour).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <div className="flex-1 bg-slate-200 dark:bg-neutral-800 rounded-full h-3 overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: i * 0.05 }} className="bg-mint-500 h-full rounded-full" />
                          </div>
                          <span className="text-xs text-slate-500 dark:text-neutral-400 w-8 text-right">{point.views}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-400 dark:text-neutral-500 text-sm text-center py-8">No viewing data yet</p>
                )}
              </motion.div>

              {/* Recipients */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl p-5">
                <h2 className="font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Users size={16} className="text-mint-500" /> Recipients</h2>
                <div className="space-y-3">
                  {data.recipients.map((r: any) => (
                    <div key={r.id} className="p-3 bg-slate-50 dark:bg-neutral-800 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.status === "SIGNED" ? "bg-ok-400" : r.status === "VIEWED" ? "bg-amber-400" : "bg-slate-300 dark:bg-neutral-600"}`} />
                        <span className="text-sm font-medium text-slate-800 dark:text-neutral-100">{r.name}</span>
                        <span className="text-xs text-slate-500 dark:text-neutral-400 ml-auto">{r.status}</span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-neutral-400 truncate mb-1">{r.email}</div>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        {r.emailSentAt && <span className="text-blue-600 dark:text-blue-400">Sent {new Date(r.emailSentAt).toLocaleDateString()}</span>}
                        {r.viewedAt && <span className="text-amber-400">Viewed {new Date(r.viewedAt).toLocaleDateString()}</span>}
                        {r.signedAt && <span className="text-green-600 dark:text-green-400">Signed {new Date(r.signedAt).toLocaleDateString()}</span>}
                        {r.ipAddress && <span className="text-slate-400 dark:text-neutral-500 font-mono">{r.ipAddress}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Visitors — full width below overview */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-neutral-800">
                <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2"><Globe size={16} className="text-mint-500" /> Visitors</h2>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">{data.visitors.length} unique visitor{data.visitors.length !== 1 ? "s" : ""}</p>
              </div>
              {data.visitors.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-neutral-800 text-xs text-slate-500 dark:text-neutral-400">
                        <th className="px-5 py-3 text-left">Location</th>
                        <th className="px-5 py-3 text-left">Device</th>
                        <th className="px-5 py-3 text-right">Views</th>
                        <th className="px-5 py-3 text-right">Pages</th>
                        <th className="px-5 py-3 text-right">Time Spent</th>
                        <th className="px-5 py-3 text-right">Last Seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.visitors.map((v: any, i: number) => (
                        <motion.tr key={v.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                          className="border-b border-slate-200/50 dark:border-neutral-800/50 hover:bg-slate-50 dark:hover:bg-neutral-800/30 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-slate-100 dark:bg-neutral-800 rounded-full flex items-center justify-center flex-shrink-0">
                                <MapPin size={12} className="text-mint-500" />
                              </div>
                              <div>
                                <div className="text-sm text-slate-700 dark:text-neutral-200">{v.location}</div>
                                <div className="text-xs text-slate-400 dark:text-neutral-500 font-mono">{v.ip}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5">
                              <Monitor size={12} className="text-slate-500 dark:text-neutral-400" />
                              <span className="text-sm text-slate-600 dark:text-neutral-300">{v.device}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-slate-700 dark:text-neutral-200">{v.totalViews}</td>
                          <td className="px-5 py-3 text-right text-sm text-slate-700 dark:text-neutral-200">{v.pagesViewed}<span className="text-slate-400 dark:text-neutral-500">/{data.stats.totalPages}</span></td>
                          <td className="px-5 py-3 text-right text-sm text-amber-400 font-medium">{formatDuration(v.totalTimeMs)}</td>
                          <td className="px-5 py-3 text-right text-xs text-slate-500 dark:text-neutral-400">{new Date(v.lastSeen).toLocaleString()}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users size={40} className="text-slate-300 dark:text-neutral-700 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-neutral-400 text-sm">No visitors yet</p>
                  <p className="text-slate-400 dark:text-neutral-500 text-xs mt-1">Visitor data appears after recipients open the signing link</p>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {tab === "heatmap" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl p-6">
            <h2 className="font-semibold text-slate-800 dark:text-white mb-2 flex items-center gap-2"><Flame size={16} className="text-mint-500" /> Page Engagement Heatmap</h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mb-6">Hotter colors = more time spent on that page</p>

            {hasViewData ? (
              <>
                {/* Legend */}
                <div className="flex items-center gap-4 mb-6 text-xs text-slate-500 dark:text-neutral-400">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-slate-200 dark:bg-neutral-800" /> No data</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-300 dark:bg-blue-800" /> Low</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-500" /> Medium</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-500" /> High</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-rose-500" /> Hottest</div>
                </div>

                {/* Page bars */}
                <div className="space-y-3">
                  {data.heatmap.map((page: any, i: number) => (
                    <motion.div key={page.page} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className={`border rounded-lg p-4 ${intensityBg(page.intensity)}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-slate-800 dark:text-neutral-100 w-16">Page {page.page}</span>
                          <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${intensityColor(page.intensity)}`} />
                            <span className="text-xs text-slate-500 dark:text-neutral-400">{Math.round(page.intensity * 100)}% intensity</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-slate-500 dark:text-neutral-400"><Eye size={11} className="inline mr-1" />{page.views} views</span>
                          <span className="text-slate-500 dark:text-neutral-400"><Clock size={11} className="inline mr-1" />Avg {formatDuration(page.avgTimeMs)}</span>
                        </div>
                      </div>
                      {/* Heat bar */}
                      <div className="h-2 bg-slate-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${page.intensity * 100}%` }} transition={{ delay: i * 0.05 + 0.2 }}
                          className={`h-full rounded-full ${intensityColor(page.intensity)}`} />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <Flame size={40} className="text-slate-300 dark:text-neutral-700 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-neutral-400 text-sm">No viewing data yet</p>
                <p className="text-slate-400 dark:text-neutral-500 text-xs mt-1">Heatmap data appears after recipients view the document</p>
              </div>
            )}
          </motion.div>
        )}

        {tab === "activity" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl p-5">
            <h2 className="font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Activity size={16} className="text-mint-500" /> Activity Timeline</h2>
            <div className="relative space-y-0">
              <div className="absolute left-[7px] top-0 bottom-0 w-px bg-slate-200 dark:bg-neutral-800" />
              {data.timeline.length > 0 ? data.timeline.map((ev: any) => {
                const cfg = EV[ev.type] || { label: ev.type, color: "text-slate-500 dark:text-neutral-400" };
                return (
                  <div key={ev.id} className="flex gap-3 pb-3">
                    <div className="w-3.5 h-3.5 rounded-full bg-slate-200 border-2 border-slate-300 dark:bg-neutral-800 dark:border-neutral-700 flex-shrink-0 mt-0.5 z-10" />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between">
                        <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
                        <span className="text-xs text-slate-400 dark:text-neutral-500 font-mono flex-shrink-0">{new Date(ev.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <div className="text-xs text-slate-400 dark:text-neutral-500">{ev.recipient || ""}{ev.ip ? ` · ${ev.ip}` : ""}</div>
                    </div>
                  </div>
                );
              }) : (
                <p className="text-slate-400 dark:text-neutral-500 text-sm text-center py-8 ml-6">No activity events yet</p>
              )}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
