"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    ArrowLeft,
    FileText,
    Users,
    CheckCircle2,
    Activity,
    TrendingUp,
    Clock,
    Send,
} from "lucide-react";
import toast from "react-hot-toast";

const EV: Record<string, { label: string; color: string }> = {
    DOCUMENT_CREATED: { label: "Created", color: "text-slate-500 dark:text-neutral-400" },
    DOCUMENT_SENT: { label: "Sent", color: "text-blue-600 dark:text-blue-400" },
    DOCUMENT_VOIDED: { label: "Voided", color: "text-red-500 dark:text-red-400" },
    DOCUMENT_COMPLETED: { label: "Completed", color: "text-green-600 dark:text-green-400" },
    EMAIL_SENT: { label: "Email Sent", color: "text-blue-600 dark:text-blue-400" },
    RECIPIENT_VIEWED: { label: "Viewed", color: "text-amber-600 dark:text-amber-400" },
    RECIPIENT_SIGNED: { label: "Signed", color: "text-green-600 dark:text-green-400" },
    RECIPIENT_DECLINED: { label: "Declined", color: "text-red-500 dark:text-red-400" },
    FIELD_SIGNED: { label: "Field completed", color: "text-green-500 dark:text-green-300" },
    DOWNLOAD: { label: "Downloaded", color: "text-slate-600 dark:text-neutral-300" },
};

const STATUS_COLORS: Record<string, string> = {
    DRAFT: "text-slate-500 dark:text-neutral-400",
    SENT: "text-blue-600 dark:text-blue-400",
    PARTIALLY_SIGNED: "text-amber-600 dark:text-amber-400",
    COMPLETED: "text-green-600 dark:text-green-400",
    DECLINED: "text-red-500 dark:text-red-400",
    EXPIRED: "text-slate-500 dark:text-neutral-400",
    VOIDED: "text-slate-500 dark:text-neutral-400",
};

export default function GlobalAnalytics() {
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        fetch("/api/analytics")
            .then((r) => r.json())
            .then(setData)
            .catch(() => toast.error("Failed to load analytics"));
    }, []);

    if (!data)
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-mint-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-neutral-950">
            <header className="border-b border-slate-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm sticky top-0 z-40">
                <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-4">
                    <button onClick={() => window.history.back()} className="text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="font-bold text-slate-800 dark:text-white">Analytics</h1>
                        <div className="text-xs text-slate-500 dark:text-neutral-400">Account overview</div>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
                {/* Top Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        {
                            label: "Total Documents",
                            value: data.stats.totalDocuments,
                            color: "text-slate-800 dark:text-white",
                            icon: FileText,
                        },
                        {
                            label: "Completed",
                            value: data.stats.completed,
                            color: "text-green-600 dark:text-green-400",
                            icon: CheckCircle2,
                        },
                        {
                            label: "Pending",
                            value: data.stats.pending,
                            color: "text-amber-600 dark:text-amber-400",
                            icon: Clock,
                        },
                        {
                            label: "Completion Rate",
                            value: `${data.stats.completionRate}%`,
                            color: "text-mint-600 dark:text-mint-400",
                            icon: TrendingUp,
                            sub: `${data.stats.signedSigners}/${data.stats.totalSigners} signers`,
                        },
                    ].map((s, i) => (
                        <motion.div
                            key={s.label}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.07 }}
                            className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <s.icon size={16} className="text-slate-400 dark:text-neutral-500" />
                            </div>
                            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                            <div className="text-slate-500 dark:text-neutral-400 text-sm mt-1">{s.label}</div>
                            {s.sub && <div className="text-xs text-slate-400 dark:text-neutral-500">{s.sub}</div>}
                        </motion.div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Document Status Breakdown */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm"
                    >
                        <h2 className="font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                            <FileText size={16} className="text-mint-500" /> Document Status Breakdown
                        </h2>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                            {data.documents?.length > 0 ? data.documents.map((doc: any) => (
                                <Link key={doc.id} href={`/documents/${doc.id}`}>
                                    <div className="flex items-center gap-3 p-3 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer group">
                                        <div className="w-8 h-8 bg-slate-200 dark:bg-neutral-700 group-hover:bg-slate-200 dark:group-hover:bg-neutral-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <FileText size={14} className="text-slate-500 dark:text-neutral-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-slate-800 dark:text-neutral-100 truncate">{doc.title}</div>
                                            <div className="text-xs text-slate-500 dark:text-neutral-400">
                                                {doc.signers > 0 ? `${doc.signed}/${doc.signers} signed` : "No signers"} · {new Date(doc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                            </div>
                                        </div>
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${doc.status === "COMPLETED" ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400" :
                                                doc.status === "SENT" ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" :
                                                    doc.status === "PARTIALLY_SIGNED" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" :
                                                        doc.status === "DECLINED" ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400" :
                                                            doc.status === "DRAFT" ? "bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-400" :
                                                                "bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-500"
                                            }`}>
                                            {doc.status.replace("_", " ")}
                                        </span>
                                    </div>
                                </Link>
                            )) : (
                                <p className="text-sm text-slate-400 dark:text-neutral-500">No documents yet</p>
                            )}
                        </div>
                    </motion.div>

                    {/* Activity Timeline */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm"
                    >
                        <h2 className="font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                            <Activity size={16} className="text-mint-500" /> Recent Activity
                        </h2>
                        {data.timeline.length > 0 ? (
                            <div className="relative space-y-0 max-h-[400px] overflow-y-auto pr-1">
                                <div className="absolute left-[7px] top-0 bottom-0 w-px bg-slate-200 dark:bg-neutral-800" />
                                {data.timeline.map((ev: any) => {
                                    const cfg = EV[ev.type] || {
                                        label: ev.type,
                                        color: "text-slate-500 dark:text-neutral-400",
                                    };
                                    return (
                                        <div key={ev.id} className="flex gap-3 pb-3">
                                            <div className="w-3.5 h-3.5 rounded-full bg-slate-200 border-2 border-slate-300 dark:bg-neutral-800 dark:border-neutral-700 flex-shrink-0 mt-0.5 z-10" />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between">
                                                    <span
                                                        className={`text-sm font-medium ${cfg.color}`}
                                                    >
                                                        {cfg.label}
                                                    </span>
                                                    <span className="text-xs text-slate-400 dark:text-neutral-500 font-mono flex-shrink-0">
                                                        {new Date(ev.createdAt).toLocaleTimeString(
                                                            "en-US",
                                                            { hour: "2-digit", minute: "2-digit" }
                                                        )}
                                                    </span>
                                                </div>
                                                {ev.docTitle && (
                                                    <div className="text-xs text-slate-500 dark:text-neutral-400 truncate">
                                                        {ev.docTitle}
                                                    </div>
                                                )}
                                                <div className="text-xs text-slate-400 dark:text-neutral-500">
                                                    {ev.recipient || ""}
                                                    {ev.ip ? ` · ${ev.ip}` : ""}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400 dark:text-neutral-500">No activity yet</p>
                        )}
                    </motion.div>
                </div>

                {/* Fields summary */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm"
                >
                    <h2 className="font-semibold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                        <Users size={16} className="text-mint-500" /> Signing Summary
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            {
                                label: "Total Signers",
                                value: data.stats.totalSigners,
                                color: "text-slate-800 dark:text-white",
                            },
                            {
                                label: "Signed",
                                value: data.stats.signedSigners,
                                color: "text-green-600 dark:text-green-400",
                            },
                            {
                                label: "Total Fields",
                                value: data.stats.totalFields,
                                color: "text-slate-800 dark:text-white",
                            },
                            {
                                label: "Fields Done",
                                value: data.stats.completedFields,
                                color: "text-green-600 dark:text-green-400",
                            },
                        ].map((s) => (
                            <div key={s.label} className="text-center">
                                <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                                <div className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </main>
        </div>
    );
}
