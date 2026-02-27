"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Pen, Send, Download, XCircle, CheckCircle2, Copy, Trash2,
  Settings, Calendar, Clock, RefreshCw, Eye, Share2, FileText, Users,
  ChevronLeft, ChevronRight, Activity, BarChart3, Edit3, Shield,
  ExternalLink, AlertTriangle, Mail, Hash, Globe, Layers, Maximize2, Minimize2
} from "lucide-react";
import toast from "react-hot-toast";

/* ─── Status config ─── */
const STATUS_CFG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  DRAFT:            { label: "Draft",       dot: "bg-slate-400",  bg: "bg-slate-100 dark:bg-neutral-800",   text: "text-slate-600 dark:text-neutral-300" },
  SENT:             { label: "Sent",        dot: "bg-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/40",     text: "text-blue-600 dark:text-blue-400" },
  PARTIALLY_SIGNED: { label: "In Progress", dot: "bg-amber-400",  bg: "bg-amber-50 dark:bg-amber-950/40",    text: "text-amber-600 dark:text-amber-400" },
  COMPLETED:        { label: "Completed",   dot: "bg-mint-500",   bg: "bg-mint-50 dark:bg-mint-950/40",     text: "text-mint-700 dark:text-mint-400" },
  DECLINED:         { label: "Declined",    dot: "bg-red-400",    bg: "bg-red-50 dark:bg-red-950/30",      text: "text-red-600 dark:text-red-400" },
  EXPIRED:          { label: "Expired",     dot: "bg-slate-400",  bg: "bg-slate-100 dark:bg-neutral-800",   text: "text-slate-500 dark:text-neutral-400" },
  VOIDED:           { label: "Voided",      dot: "bg-slate-400",  bg: "bg-slate-100 dark:bg-neutral-800",   text: "text-slate-500 dark:text-neutral-400" },
};

const RSTATUS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  PENDING:  { label: "Pending",  color: "text-slate-500 dark:text-neutral-400",  bg: "bg-slate-100 dark:bg-neutral-800", icon: "⏳" },
  SENT:     { label: "Sent",     color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/40",   icon: "📧" },
  VIEWED:   { label: "Viewed",   color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-950/40",  icon: "👁" },
  SIGNED:   { label: "Signed",   color: "text-mint-700 dark:text-mint-400",   bg: "bg-mint-50 dark:bg-mint-950/40",   icon: "✓" },
  DECLINED: { label: "Declined", color: "text-red-600 dark:text-red-400",    bg: "bg-red-50 dark:bg-red-950/30",    icon: "✗" },
};

const EV_LABELS: Record<string, { label: string; color: string; icon: typeof Activity }> = {
  DOCUMENT_CREATED:   { label: "Document Created",    color: "text-slate-500",  icon: FileText },
  DOCUMENT_SENT:      { label: "Sent for Signing",    color: "text-blue-500",   icon: Send },
  DOCUMENT_VOIDED:    { label: "Document Voided",     color: "text-red-500",    icon: XCircle },
  DOCUMENT_COMPLETED: { label: "All Signatures Done", color: "text-mint-600",   icon: CheckCircle2 },
  EMAIL_SENT:         { label: "Email Sent",          color: "text-blue-500",   icon: Mail },
  RECIPIENT_VIEWED:   { label: "Viewed by Signer",    color: "text-amber-500",  icon: Eye },
  RECIPIENT_SIGNED:   { label: "Signed",              color: "text-mint-600",   icon: Pen },
  RECIPIENT_DECLINED: { label: "Declined",            color: "text-red-500",    icon: XCircle },
  FIELD_SIGNED:       { label: "Field Completed",     color: "text-mint-500",   icon: CheckCircle2 },
  DOWNLOAD:           { label: "Downloaded",          color: "text-slate-500",  icon: Download },
};

const TABS = [
  { key: "overview", label: "Overview", icon: Layers },
  { key: "preview",  label: "Preview",  icon: Eye },
  { key: "activity", label: "Activity", icon: Activity },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
];

export default function DocDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [tab, setTab] = useState("overview");
  const [sending, setSending] = useState(false);
  const [senderName, setSenderName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pixsign_user_name") || "Document Sender";
    }
    return "Document Sender";
  });

  /* Modals */
  const [voidModal, setVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [deleteModal, setDeleteModal] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editSigningOrder, setEditSigningOrder] = useState("PARALLEL");
  const [editExpires, setEditExpires] = useState("");

  /* PDF Preview */
  const [pdfImgs, setPdfImgs] = useState<string[]>([]);
  const [pdfPage, setPdfPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  /* ─── Load document ─── */
  const load = useCallback(async () => {
    const d = await fetch(`/api/documents/${id}`).then(r => r.json());
    setDoc(d);
    if (d.senderName) setSenderName(d.senderName);
    setEditTitle(d.title || "");
    setEditMessage(d.message || "");
    setEditSigningOrder(d.signingOrder || "PARALLEL");
    setEditExpires(d.expiresAt ? new Date(d.expiresAt).toISOString().split("T")[0] : "");
  }, [id]);

  /* ─── Load analytics ─── */
  const loadAnalytics = useCallback(async () => {
    try {
      const a = await fetch(`/api/documents/${id}/analytics`).then(r => r.json());
      setAnalytics(a);
    } catch { /* silent */ }
  }, [id]);

  /* ─── Render PDF ─── */
  const renderPdf = useCallback(async (url: string) => {
    try {
      setPdfLoading(true);
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
      const pdf = await pdfjsLib.getDocument(url).promise;
      setTotalPages(pdf.numPages);
      const imgs: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const pg = await pdf.getPage(i);
        const vp = pg.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = vp.width; canvas.height = vp.height;
        await pg.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
        imgs.push(canvas.toDataURL("image/jpeg", 0.85));
      }
      setPdfImgs(imgs);
    } catch (e) {
      console.error("PDF render failed:", e);
    } finally { setPdfLoading(false); }
  }, []);

  useEffect(() => { load(); loadAnalytics(); }, [load, loadAnalytics]);

  useEffect(() => {
    if (doc) {
      if (doc.pdfUrl) renderPdf(doc.pdfUrl);
    }
  }, [doc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Actions ─── */
  async function send() {
    setSending(true);
    try {
      const res = await fetch(`/api/documents/${id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senderName }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Sent for signatures!");
      load(); loadAnalytics();
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setSending(false); }
  }

  async function voidDoc() {
    await fetch(`/api/documents/${id}/void`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: voidReason }) });
    toast.success("Document voided");
    setVoidModal(false);
    load(); loadAnalytics();
  }

  async function deleteDoc() {
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Document deleted");
      router.back();
    } catch (e: any) { toast.error(e.message || "Failed"); }
  }

  async function saveEdit() {
    try {
      const body: any = { title: editTitle, message: editMessage, signingOrder: editSigningOrder };
      if (editExpires) body.expiresAt = editExpires;
      await fetch(`/api/documents/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      toast.success("Saved");
      setEditOpen(false);
      load();
    } catch { toast.error("Failed to save"); }
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/sign/${id}/${token}`);
    toast.success("Signing link copied!");
  }

  function copyShareLink() {
    navigator.clipboard.writeText(`${window.location.origin}/share/${id}`);
    toast.success("Share link copied!");
  }

  async function extendExpiry(days: number) {
    const newDate = new Date(doc.expiresAt ? new Date(doc.expiresAt).getTime() + days * 86400000 : Date.now() + days * 86400000);
    try {
      await fetch(`/api/documents/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expiresAt: newDate.toISOString() }) });
      toast.success(`Extended by ${days} days`);
      load();
    } catch { toast.error("Failed to extend"); }
  }

  function getExpiryInfo() {
    if (!doc?.expiresAt) return null;
    const diff = new Date(doc.expiresAt).getTime() - Date.now();
    if (diff <= 0) return { label: "Expired", color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/30", urgent: true };
    if (diff < 86400000) {
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      return { label: `${h}h ${m}m left`, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/30", urgent: true };
    }
    if (diff < 604800000) {
      const d = Math.floor(diff / 86400000);
      return { label: `${d} day${d > 1 ? "s" : ""} left`, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40", urgent: false };
    }
    const d = Math.floor(diff / 86400000);
    return { label: `${d} days left`, color: "text-mint-600 dark:text-mint-400", bg: "bg-mint-50 dark:bg-mint-950/40", urgent: false };
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return new Date(date).toLocaleDateString();
  }

  /* ─── Loading ─── */
  if (!doc) return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-mint-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const signers = doc.recipients?.filter((r: any) => r.role === "SIGNER") || [];
  const ccRecipients = doc.recipients?.filter((r: any) => r.role === "CC") || [];
  const signedCount = signers.filter((r: any) => r.status === "SIGNED").length;
  const isDraft = doc.status === "DRAFT";
  const isActive = ["SENT", "PARTIALLY_SIGNED"].includes(doc.status);
  const isCompleted = doc.status === "COMPLETED";
  const isTerminal = ["COMPLETED", "VOIDED", "DECLINED", "EXPIRED"].includes(doc.status);
  const st = STATUS_CFG[doc.status] || STATUS_CFG.DRAFT;
  const expiry = getExpiryInfo();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950">
      {/* ═══ Header ═══ */}
      <header className="border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 transition-colors">
            <ArrowLeft size={20} />
          </Link>

          {/* Title area */}
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-mint-400 to-mint-600 rounded-xl flex items-center justify-center shadow-md shadow-mint-200 dark:shadow-mint-900/30 flex-shrink-0">
              <FileText size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-slate-800 dark:text-white truncate text-base">{doc.title}</h1>
              <div className="flex items-center gap-2 text-xs">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium ${st.bg} ${st.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                  {st.label}
                </span>
                <span className="text-slate-400 dark:text-neutral-500">·</span>
                <span className="text-slate-400 dark:text-neutral-500">{new Date(doc.createdAt).toLocaleDateString()}</span>
                {expiry && (
                  <>
                    <span className="text-slate-400 dark:text-neutral-500">·</span>
                    <span className={`inline-flex items-center gap-1 font-medium ${expiry.color}`}>
                      <Clock size={10} />{expiry.label}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2">
            {isDraft && (
              <Link href={`/documents/${id}/prepare`} className="flex items-center gap-1.5 px-4 py-2 bg-mint-50 dark:bg-mint-950/40 hover:bg-mint-100 dark:hover:bg-mint-900/50 text-mint-700 dark:text-mint-400 rounded-xl text-sm font-medium transition-colors border border-mint-200 dark:border-mint-800">
                <Edit3 size={14} /> Edit Fields
              </Link>
            )}
            {isCompleted && (
              <a href={`/api/documents/${id}/download`} className="flex items-center gap-1.5 px-4 py-2 bg-mint-500 hover:bg-mint-600 text-white rounded-xl text-sm font-medium transition-colors shadow-sm shadow-mint-200 dark:shadow-mint-900/30">
                <Download size={14} /> Download
              </a>
            )}
            <button onClick={copyShareLink} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-600 dark:text-neutral-300 rounded-xl text-sm font-medium transition-colors">
              <Share2 size={14} /> Share
            </button>
            {!isTerminal && (
              <button onClick={() => setVoidModal(true)} className="p-2 rounded-xl bg-slate-100 dark:bg-neutral-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 dark:text-neutral-500 hover:text-red-500 transition-all" title="Void document">
                <XCircle size={16} />
              </button>
            )}
            {isDraft && (
              <button onClick={() => setDeleteModal(true)} className="p-2 rounded-xl bg-slate-100 dark:bg-neutral-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 dark:text-neutral-500 hover:text-red-500 transition-all" title="Delete document">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ═══ Tab navigation ═══ */}
      <div className="border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                tab === t.key
                  ? "border-mint-500 text-mint-700 dark:text-mint-400"
                  : "border-transparent text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 hover:border-slate-300 dark:hover:border-neutral-600"
              }`}>
              <t.icon size={15} />{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ Content ═══ */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <AnimatePresence mode="wait">
          {/* ═══════ OVERVIEW TAB ═══════ */}
          {tab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left: main content */}
              <div className="lg:col-span-2 space-y-5">
                {/* Status banner for completed docs */}
                {isCompleted && (
                  <div className="flex items-center gap-3 p-4 bg-mint-50 dark:bg-mint-950/40 border border-mint-200 dark:border-mint-800 rounded-2xl">
                    <div className="w-10 h-10 bg-mint-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 size={20} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-mint-800 dark:text-mint-300">All signatures collected</p>
                      <p className="text-xs text-mint-600 dark:text-mint-400">Completed on {new Date(doc.completedAt).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
                    </div>
                    <a href={`/api/documents/${id}/download`} className="flex items-center gap-1.5 px-4 py-2 bg-mint-500 hover:bg-mint-600 text-white rounded-xl text-sm font-medium transition-colors">
                      <Download size={14} /> Download PDF
                    </a>
                  </div>
                )}

                {/* Expired/Voided/Declined banner */}
                {(doc.status === "EXPIRED" || doc.status === "VOIDED" || doc.status === "DECLINED") && (
                  <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl">
                    <div className="w-10 h-10 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center flex-shrink-0">
                      <AlertTriangle size={20} className="text-red-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                        {doc.status === "EXPIRED" && "This document has expired"}
                        {doc.status === "VOIDED" && "This document was voided"}
                        {doc.status === "DECLINED" && "A signer declined this document"}
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {doc.status === "EXPIRED" && `Expired on ${new Date(doc.expiresAt).toLocaleDateString()}`}
                        {doc.status === "VOIDED" && `Voided on ${new Date(doc.voidedAt || doc.updatedAt).toLocaleDateString()}${doc.voidReason ? ` — ${doc.voidReason}` : ""}`}
                        {doc.status === "DECLINED" && "One or more signers declined to sign"}
                      </p>
                    </div>
                  </div>
                )}

                {/* PDF mini preview + signing progress */}
                <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
                  {/* Mini PDF preview */}
                  <div className="relative bg-slate-100 dark:bg-neutral-800 border-b border-slate-200 dark:border-neutral-800">
                    {pdfLoading ? (
                      <div className="flex items-center justify-center h-64">
                        <div className="w-6 h-6 border-2 border-mint-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : pdfImgs[0] ? (
                      <div className="relative group cursor-pointer" onClick={() => setTab("preview")}>
                        <img src={pdfImgs[0]} alt="" className="w-full h-64 object-cover object-top" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className="absolute bottom-3 left-4 right-4 flex justify-between items-end">
                          <div>
                            <p className="text-white/70 text-xs">{totalPages} page{totalPages > 1 ? "s" : ""}</p>
                          </div>
                          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-lg text-xs font-medium transition-colors">
                            <Maximize2 size={12} /> View Document
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-64 text-slate-400 dark:text-neutral-500 text-sm">No preview available</div>
                    )}
                  </div>

                  {/* Signing Progress */}
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-semibold text-slate-800 dark:text-white">Signing Progress</h2>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        signedCount === signers.length && signers.length > 0 ? "bg-mint-50 dark:bg-mint-950/40 text-mint-700 dark:text-mint-400" : "bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300"
                      }`}>
                        {signedCount}/{signers.length} signed
                      </span>
                    </div>

                    {signers.length > 0 ? (
                      <>
                        {/* Progress bar */}
                        <div className="w-full bg-slate-100 dark:bg-neutral-800 rounded-full h-2 mb-5">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${signers.length ? (signedCount / signers.length) * 100 : 0}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="bg-mint-500 h-2 rounded-full"
                          />
                        </div>

                        {/* Recipient list */}
                        <div className="space-y-2">
                          {signers.map((r: any, i: number) => {
                            const rs = RSTATUS[r.status] || RSTATUS.PENDING;
                            return (
                              <div key={r.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-neutral-800 border border-slate-100 dark:border-neutral-800 rounded-xl hover:border-slate-200 dark:hover:border-neutral-700 transition-all">
                                <div className="relative">
                                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
                                    r.status === "SIGNED" ? "bg-mint-500 text-white" : "bg-slate-200 dark:bg-neutral-700 text-slate-500 dark:text-neutral-400"
                                  }`}>
                                    {r.name?.[0]?.toUpperCase() || "?"}
                                  </div>
                                  {doc.signingOrder === "SEQUENTIAL" && (
                                    <span className="absolute -top-1 -left-1 w-4 h-4 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-full flex items-center justify-center text-[9px] font-bold text-slate-500 dark:text-neutral-400">{i + 1}</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-slate-700 dark:text-neutral-200 truncate">{r.name}</div>
                                  <div className="text-xs text-slate-400 dark:text-neutral-500 truncate">{r.email}</div>
                                </div>
                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${rs.bg} ${rs.color}`}>{rs.label}</span>
                                {r.signedAt && <span className="text-[10px] text-slate-400 dark:text-neutral-500">{timeAgo(r.signedAt)}</span>}
                                {isActive && r.status !== "SIGNED" && r.role === "SIGNER" && (
                                  <button onClick={() => copyLink(r.token)} title="Copy signing link" className="p-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 hover:bg-mint-50 dark:hover:bg-mint-950/40 text-slate-400 dark:text-neutral-500 hover:text-mint-600 dark:hover:text-mint-400 transition-colors">
                                    <Copy size={13} />
                                  </button>
                                )}
                              </div>
                            );
                          })}

                          {/* CC recipients */}
                          {ccRecipients.length > 0 && (
                            <div className="pt-2 mt-2 border-t border-slate-100 dark:border-neutral-800">
                              <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-neutral-500 font-semibold mb-2">CC Recipients</p>
                              {ccRecipients.map((r: any) => (
                                <div key={r.id} className="flex items-center gap-3 py-2 text-sm text-slate-500 dark:text-neutral-400">
                                  <Mail size={14} className="text-slate-300 dark:text-neutral-600" />
                                  <span className="truncate">{r.name} ({r.email})</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-6">
                        <Users size={32} className="text-slate-300 dark:text-neutral-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-500 dark:text-neutral-400">No recipients added yet</p>
                        {isDraft && <Link href={`/documents/${id}/prepare`} className="text-xs text-mint-600 dark:text-mint-400 hover:text-mint-700 dark:hover:text-mint-300 font-medium mt-1 inline-block">Add recipients →</Link>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Draft: Send section */}
                {isDraft && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5 space-y-4">
                    <h2 className="font-semibold text-slate-800 dark:text-white">Send for Signature</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { label: "Prepare fields", desc: "Place signature & field boxes on PDF", href: `/documents/${id}/prepare`, done: doc.fields?.length > 0, icon: Edit3 },
                        { label: "Add recipients", desc: "Add signers and CC recipients", href: `/documents/${id}/prepare`, done: doc.recipients?.length > 0, icon: Users },
                      ].map(step => (
                        <Link key={step.label} href={step.href}>
                          <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-700 border border-slate-100 dark:border-neutral-800 hover:border-slate-200 dark:hover:border-neutral-700 rounded-xl transition-all group cursor-pointer h-full">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${step.done ? "bg-mint-500 text-white" : "bg-slate-200 dark:bg-neutral-700 text-slate-400 dark:text-neutral-500"}`}>
                              {step.done ? <CheckCircle2 size={16} /> : <step.icon size={16} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-slate-700 dark:text-neutral-200">{step.label}</div>
                              <div className="text-xs text-slate-400 dark:text-neutral-500">{step.desc}</div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 dark:text-neutral-400 block mb-1.5">Your name (shown to signers)</label>
                      <input value={senderName} onChange={e => setSenderName(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-800 rounded-xl text-sm text-slate-700 dark:text-neutral-200 focus:outline-none focus:border-mint-400 focus:ring-2 focus:ring-mint-100 dark:focus:ring-mint-900/30 transition-all" />
                    </div>
                    <button onClick={send} disabled={sending || !signers.length}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-mint-500 hover:bg-mint-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all shadow-sm shadow-mint-200 dark:shadow-mint-900/30">
                      {sending ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Send size={16} />}
                      {sending ? "Sending..." : "Send for Signature"}
                    </button>
                    {!signers.length && <p className="text-xs text-amber-600 dark:text-amber-400 text-center bg-amber-50 dark:bg-amber-950/40 px-3 py-2 rounded-lg">⚠ Add at least one signer in the field editor before sending</p>}
                  </motion.div>
                )}

                {/* Recent activity preview */}
                {analytics?.timeline && analytics.timeline.length > 0 && (
                  <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-semibold text-slate-800 dark:text-white">Recent Activity</h2>
                      <button onClick={() => setTab("activity")} className="text-xs text-mint-600 dark:text-mint-400 hover:text-mint-700 dark:hover:text-mint-300 font-medium">View all →</button>
                    </div>
                    <div className="space-y-0">
                      {analytics.timeline.slice(-5).reverse().map((ev: any, i: number) => {
                        const evCfg = EV_LABELS[ev.type] || { label: ev.type, color: "text-slate-500", icon: Activity };
                        const Icon = evCfg.icon;
                        return (
                          <div key={ev.id || i} className="flex items-start gap-3 py-2.5 border-b border-slate-50 dark:border-neutral-800 last:border-0">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-slate-100 dark:bg-neutral-800 mt-0.5`}>
                              <Icon size={13} className={evCfg.color} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-700 dark:text-neutral-200">{evCfg.label}</p>
                              {ev.recipient && <p className="text-xs text-slate-400 dark:text-neutral-500 truncate">{ev.recipient}</p>}
                            </div>
                            <span className="text-[11px] text-slate-400 dark:text-neutral-500 whitespace-nowrap">{timeAgo(ev.createdAt)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Right sidebar */}
              <div className="space-y-4">
                {/* Document info card */}
                <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5">
                  <h3 className="text-xs font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-wider mb-4">Document Details</h3>
                  <div className="space-y-3.5 text-sm">
                    <InfoRow label="Document ID" value={<span className="font-mono text-[11px]">{doc.id.slice(0, 8)}...</span>} />
                    <InfoRow label="Status" value={
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}
                      </span>
                    } />
                    <InfoRow label="Created" value={new Date(doc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} />
                    {doc.completedAt && <InfoRow label="Completed" value={new Date(doc.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} />}
                    <InfoRow label="Signing Order" value={
                      <span className="inline-flex items-center gap-1">
                        {doc.signingOrder === "SEQUENTIAL" ? "Sequential" : "Parallel"}
                      </span>
                    } />
                    <InfoRow label="Fields" value={`${doc.fields?.length || 0} placed`} />
                    <InfoRow label="Recipients" value={`${doc.recipients?.length || 0} total`} />
                    {doc.originalHash && <InfoRow label="Hash" value={<span className="font-mono text-[10px]">{doc.originalHash.slice(0, 16)}...</span>} />}
                    {expiry && (
                      <InfoRow label="Expires" value={
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${expiry.color}`}>
                          <Clock size={10} />{expiry.label}
                        </span>
                      } />
                    )}
                  </div>
                </div>

                {/* Quick stats (if analytics available) */}
                {analytics?.stats && (
                  <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5">
                    <h3 className="text-xs font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-wider mb-4">Quick Stats</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <StatBox label="Views" value={analytics.stats.totalViews} icon={Eye} />
                      <StatBox label="Visitors" value={analytics.stats.uniqueVisitors} icon={Users} />
                      <StatBox label="Avg Time" value={analytics.stats.avgDurationMs > 0 ? `${Math.round(analytics.stats.avgDurationMs / 1000)}s` : "—"} icon={Clock} />
                      <StatBox label="Pages" value={analytics.stats.totalPages} icon={FileText} />
                    </div>
                  </div>
                )}

                {/* Extend expiry */}
                {isActive && doc.expiresAt && (
                  <button onClick={() => extendExpiry(7)} className="w-full flex items-center gap-3 p-4 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50/30 dark:hover:bg-amber-950/20 rounded-2xl cursor-pointer transition-all text-left">
                    <RefreshCw size={18} className="text-amber-500 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-700 dark:text-neutral-200">Extend +7 Days</div>
                      <div className="text-xs text-slate-400 dark:text-neutral-500">Push the expiration date forward</div>
                    </div>
                  </button>
                )}

                {/* Edit settings */}
                {isDraft && (
                  <>
                    <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
                      <button onClick={() => setEditOpen(!editOpen)} className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors text-left">
                        <Settings size={18} className="text-slate-400 dark:text-neutral-500 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-slate-700 dark:text-neutral-200">Document Settings</div>
                          <div className="text-xs text-slate-400 dark:text-neutral-500">Title, message, signing order</div>
                        </div>
                        <ChevronRight size={15} className={`text-slate-300 dark:text-neutral-600 transition-transform ${editOpen ? "rotate-90" : ""}`} />
                      </button>
                      <AnimatePresence>
                        {editOpen && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                            className="border-t border-slate-100 dark:border-neutral-800 px-5 pb-5 pt-4 space-y-3 overflow-hidden">
                            <div>
                              <label className="text-xs font-medium text-slate-500 dark:text-neutral-400 block mb-1">Title</label>
                              <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-800 rounded-xl text-sm text-slate-700 dark:text-neutral-200 focus:outline-none focus:border-mint-400 focus:ring-2 focus:ring-mint-100 dark:focus:ring-mint-900/30 transition-all" />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-slate-500 dark:text-neutral-400 block mb-1">Message for signers</label>
                              <textarea value={editMessage} onChange={e => setEditMessage(e.target.value)} placeholder="Optional message shown to recipients" rows={2}
                                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-800 rounded-xl text-sm text-slate-700 dark:text-neutral-200 placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-mint-400 focus:ring-2 focus:ring-mint-100 dark:focus:ring-mint-900/30 resize-none transition-all" />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-slate-500 dark:text-neutral-400 block mb-1">Signing Order</label>
                              <select value={editSigningOrder} onChange={e => setEditSigningOrder(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-800 rounded-xl text-sm text-slate-700 dark:text-neutral-200 focus:outline-none focus:border-mint-400 focus:ring-2 focus:ring-mint-100 dark:focus:ring-mint-900/30 transition-all">
                                <option value="PARALLEL">Parallel (everyone signs at once)</option>
                                <option value="SEQUENTIAL">Sequential (one at a time)</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-slate-500 dark:text-neutral-400 block mb-1 flex items-center gap-1"><Calendar size={11} /> Expiration date</label>
                              <input type="date" value={editExpires} onChange={e => setEditExpires(e.target.value)} min={new Date().toISOString().split("T")[0]}
                                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-800 rounded-xl text-sm text-slate-700 dark:text-neutral-200 focus:outline-none focus:border-mint-400 focus:ring-2 focus:ring-mint-100 dark:focus:ring-mint-900/30 transition-all" />
                            </div>
                            <button onClick={saveEdit} className="w-full py-2.5 bg-mint-500 hover:bg-mint-600 text-white rounded-xl text-sm font-semibold transition-colors">Save Changes</button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <Link href={`/documents/${id}/prepare`}>
                      <div className="flex items-center gap-3 p-4 bg-mint-50 dark:bg-mint-950/40 border border-mint-200 dark:border-mint-800 hover:border-mint-400 dark:hover:border-mint-600 rounded-2xl cursor-pointer group transition-all">
                        <Pen size={18} className="text-mint-500 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-semibold text-mint-700 dark:text-mint-400">Open Editor</div>
                          <div className="text-xs text-mint-500 dark:text-mint-500">Place fields & add recipients</div>
                        </div>
                        <ChevronRight size={15} className="ml-auto text-mint-400 group-hover:text-mint-600 dark:group-hover:text-mint-300 transition-colors" />
                      </div>
                    </Link>
                  </>
                )}

                {/* Security info */}
                <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5">
                  <h3 className="text-xs font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-wider mb-3">Security</h3>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
                      <Shield size={13} className="text-mint-500" />
                      <span>SHA-256 integrity hash</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
                      <Globe size={13} className="text-mint-500" />
                      <span>IP tracking on all events</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
                      <Hash size={13} className="text-mint-500" />
                      <span>Full audit trail embedded in PDF</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══════ PREVIEW TAB ═══════ */}
          {tab === "preview" && (
            <motion.div key="preview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <div className={`${fullscreen ? "fixed inset-0 z-50 bg-slate-900/95 flex flex-col" : ""}`}>
                {/* Toolbar */}
                <div className={`flex items-center justify-between gap-4 ${fullscreen ? "px-6 py-3 bg-slate-800" : "mb-4"}`}>
                  <div className="flex items-center gap-3">
                    {fullscreen && (
                      <button onClick={() => setFullscreen(false)} className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors">
                        <Minimize2 size={16} />
                      </button>
                    )}
                    {totalPages > 1 && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => setPdfPage(p => Math.max(1, p - 1))} disabled={pdfPage === 1}
                          className={`p-2 rounded-lg transition-colors ${fullscreen ? "bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-30" : "bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-500 dark:text-neutral-400 disabled:opacity-30"}`}>
                          <ChevronLeft size={16} />
                        </button>
                        <span className={`text-sm font-medium min-w-[80px] text-center ${fullscreen ? "text-white" : "text-slate-600 dark:text-neutral-300"}`}>
                          Page {pdfPage} / {totalPages}
                        </span>
                        <button onClick={() => setPdfPage(p => Math.min(totalPages, p + 1))} disabled={pdfPage === totalPages}
                          className={`p-2 rounded-lg transition-colors ${fullscreen ? "bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-30" : "bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-500 dark:text-neutral-400 disabled:opacity-30"}`}>
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={`/api/documents/${id}/download`}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${fullscreen ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-600 dark:text-neutral-300"}`}>
                      <Download size={14} /> Download
                    </a>
                    {!fullscreen && (
                      <button onClick={() => setFullscreen(true)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-600 dark:text-neutral-300 rounded-xl text-sm font-medium transition-colors">
                        <Maximize2 size={14} /> Fullscreen
                      </button>
                    )}
                  </div>
                </div>

                {/* PDF display */}
                <div className={`flex-1 ${fullscreen ? "overflow-auto flex justify-center py-8 px-4" : "flex justify-center"}`}>
                  {pdfLoading ? (
                    <div className="flex items-center justify-center h-96">
                      <div className="w-8 h-8 border-2 border-mint-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : pdfImgs[pdfPage - 1] ? (
                    <img
                      src={pdfImgs[pdfPage - 1]}
                      alt={`Page ${pdfPage}`}
                      className={`${fullscreen ? "max-h-full w-auto" : "max-w-4xl w-full h-auto"} shadow-xl rounded-xl border border-slate-200 dark:border-neutral-800`}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-96 text-slate-400 dark:text-neutral-500">
                      <FileText size={48} className="mb-3 text-slate-300 dark:text-neutral-600" />
                      <p className="text-sm">Unable to display PDF</p>
                      <a href={`/api/documents/${id}/download`} className="text-xs text-mint-600 dark:text-mint-400 hover:text-mint-700 dark:hover:text-mint-300 font-medium mt-2">Download instead →</a>
                    </div>
                  )}
                </div>

                {/* Page thumbnails in fullscreen */}
                {fullscreen && totalPages > 1 && (
                  <div className="flex justify-center gap-2 py-3 px-4 bg-slate-800 border-t border-slate-700 overflow-x-auto">
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button key={i} onClick={() => setPdfPage(i + 1)}
                        className={`flex-shrink-0 w-12 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                          pdfPage === i + 1 ? "border-mint-500 shadow-lg shadow-mint-500/20" : "border-slate-600 hover:border-slate-500 opacity-60 hover:opacity-100"
                        }`}>
                        {pdfImgs[i] && <img src={pdfImgs[i]} alt="" className="w-full h-full object-cover" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══════ ACTIVITY TAB ═══════ */}
          {tab === "activity" && (
            <motion.div key="activity" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="max-w-3xl">
              <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6">
                <h2 className="font-semibold text-slate-800 dark:text-white mb-6">Activity Timeline</h2>
                {analytics?.timeline && analytics.timeline.length > 0 ? (
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-200 dark:bg-neutral-800" />

                    <div className="space-y-0">
                      {[...analytics.timeline].reverse().map((ev: any, i: number) => {
                        const evCfg = EV_LABELS[ev.type] || { label: ev.type, color: "text-slate-500", icon: Activity };
                        const Icon = evCfg.icon;
                        return (
                          <div key={ev.id || i} className="relative flex items-start gap-4 py-3 group">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-white dark:bg-neutral-900 border-2 border-slate-200 dark:border-neutral-800 z-10 group-hover:border-mint-300 dark:group-hover:border-mint-700 transition-colors`}>
                              <Icon size={14} className={evCfg.color} />
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-slate-700 dark:text-neutral-200">{evCfg.label}</p>
                                <span className="text-[11px] text-slate-400 dark:text-neutral-500">{timeAgo(ev.createdAt)}</span>
                              </div>
                              {ev.recipient && <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">{ev.recipient}</p>}
                              {ev.ip && <p className="text-[10px] text-slate-400 dark:text-neutral-500 mt-0.5 font-mono">IP: {ev.ip}</p>}
                              <p className="text-[10px] text-slate-300 dark:text-neutral-600 mt-0.5">{new Date(ev.createdAt).toLocaleString()}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Activity size={40} className="text-slate-300 dark:text-neutral-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 dark:text-neutral-400">No activity yet</p>
                    <p className="text-xs text-slate-400 dark:text-neutral-500 mt-1">Activity will appear here once the document is sent</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══════ ANALYTICS TAB ═══════ */}
          {tab === "analytics" && (
            <motion.div key="analytics" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              {analytics?.stats ? (
                <div className="space-y-6">
                  {/* Stats grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <AnalyticCard label="Total Views" value={analytics.stats.totalViews} icon={Eye} color="blue" />
                    <AnalyticCard label="Unique Visitors" value={analytics.stats.uniqueVisitors} icon={Users} color="mint" />
                    <AnalyticCard label="Avg Time Spent" value={analytics.stats.avgDurationMs > 0 ? `${Math.round(analytics.stats.avgDurationMs / 1000)}s` : "—"} icon={Clock} color="amber" />
                    <AnalyticCard label="Signing Rate" value={`${analytics.stats.completionRate}%`} icon={CheckCircle2} color="mint" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Page heatmap — compact grid */}
                    {analytics.heatmap && analytics.heatmap.length > 0 && (
                      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-slate-800 dark:text-white">Page Heatmap</h3>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-neutral-500">
                            <span>Less</span>
                            {[0, 0.25, 0.5, 0.75, 1].map(v => (
                              <div key={v}
                                className={`w-3 h-3 rounded-sm ${v === 0 ? "bg-slate-100 dark:bg-neutral-800" : ""}`}
                                style={v > 0 ? { background: `rgba(34,197,94,${0.2 + v * 0.8})` } : undefined} />
                            ))}
                            <span>More</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {analytics.heatmap.map((pg: any, i: number) => {
                            const maxViews = Math.max(...analytics.heatmap.map((p: any) => p.views), 1);
                            return (
                              <motion.div key={pg.page} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.02 }}
                                className="group relative">
                                <div
                                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-bold transition-transform hover:scale-110 cursor-default ${pg.views === 0 ? "bg-slate-100 dark:bg-neutral-800 text-slate-400 dark:text-neutral-500" : ""}`}
                                  style={pg.views > 0 ? {
                                    background: `rgba(34,197,94,${0.15 + pg.intensity * 0.85})`,
                                    color: pg.intensity > 0.5 ? "white" : undefined,
                                  } : undefined}>
                                  {pg.page}
                                </div>
                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-neutral-900 dark:bg-neutral-700 text-white text-[10px] rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20 shadow-lg">
                                  <div className="font-semibold">Page {pg.page}</div>
                                  <div>{pg.views} view{pg.views !== 1 ? "s" : ""} · {Math.round(pg.intensity * 100)}%</div>
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-neutral-900 dark:border-t-neutral-700" />
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-neutral-500 mt-3">{analytics.heatmap.length} page{analytics.heatmap.length !== 1 ? "s" : ""} · Hover for details</p>
                      </div>
                    )}

                    {/* Signing progress detail */}
                    <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5">
                      <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Signing Overview</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center p-3 bg-slate-50 dark:bg-neutral-800 rounded-xl">
                          <p className="text-2xl font-bold text-slate-800 dark:text-white">{analytics.stats.totalSigners}</p>
                          <p className="text-xs text-slate-500 dark:text-neutral-400">Total Signers</p>
                        </div>
                        <div className="text-center p-3 bg-mint-50 dark:bg-mint-950/40 rounded-xl">
                          <p className="text-2xl font-bold text-mint-700 dark:text-mint-400">{analytics.stats.signedCount}</p>
                          <p className="text-xs text-mint-600 dark:text-mint-400">Signed</p>
                        </div>
                        <div className="text-center p-3 bg-slate-50 dark:bg-neutral-800 rounded-xl">
                          <p className="text-2xl font-bold text-slate-800 dark:text-white">{analytics.stats.totalFields}</p>
                          <p className="text-xs text-slate-500 dark:text-neutral-400">Total Fields</p>
                        </div>
                        <div className="text-center p-3 bg-mint-50 dark:bg-mint-950/40 rounded-xl">
                          <p className="text-2xl font-bold text-mint-700 dark:text-mint-400">{analytics.stats.completedFields}</p>
                          <p className="text-xs text-mint-600 dark:text-mint-400">Fields Completed</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Visitors — full width below */}
                  {analytics.visitors && analytics.visitors.length > 0 && (
                    <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5">
                      <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Visitors</h3>
                      <div className="space-y-2">
                        {analytics.visitors.map((v: any) => (
                          <div key={v.id} className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-neutral-800 rounded-xl">
                            <div className="w-8 h-8 bg-slate-200 dark:bg-neutral-700 rounded-full flex items-center justify-center text-xs font-bold text-slate-500 dark:text-neutral-400">
                              {v.device?.[0] || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-600 dark:text-neutral-300">{v.device} · {v.location}</p>
                              <p className="text-[10px] text-slate-400 dark:text-neutral-500">{v.pagesViewed} pages · {Math.round(v.totalTimeMs / 1000)}s total</p>
                            </div>
                            <span className="text-[10px] text-slate-400 dark:text-neutral-500">{timeAgo(v.lastSeen)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16">
                  <BarChart3 size={48} className="text-slate-300 dark:text-neutral-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 dark:text-neutral-400">No analytics data yet</p>
                  <p className="text-xs text-slate-400 dark:text-neutral-500 mt-1">Analytics will appear once the document is sent and viewed</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ═══ Void Modal ═══ */}
      <AnimatePresence>
        {voidModal && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <div className="w-12 h-12 bg-red-50 dark:bg-red-950/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle size={24} className="text-red-500" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white text-lg mb-1 text-center">Void Document</h3>
              <p className="text-slate-500 dark:text-neutral-400 text-sm mb-4 text-center">This will cancel signing for all recipients. This cannot be undone.</p>
              <textarea value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="Reason for voiding (optional)" rows={2}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-800 rounded-xl text-sm text-slate-700 dark:text-neutral-200 placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-mint-400 focus:ring-2 focus:ring-mint-100 dark:focus:ring-mint-900/30 resize-none mb-4 transition-all" />
              <div className="flex gap-3">
                <button onClick={() => setVoidModal(false)} className="flex-1 py-2.5 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-600 dark:text-neutral-300 rounded-xl text-sm font-medium transition-colors">Cancel</button>
                <button onClick={voidDoc} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-colors">Void Document</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ Delete Modal ═══ */}
      <AnimatePresence>
        {deleteModal && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <div className="w-12 h-12 bg-red-50 dark:bg-red-950/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white text-lg mb-1 text-center">Delete Document</h3>
              <p className="text-slate-500 dark:text-neutral-400 text-sm mb-4 text-center">This will permanently delete this document and all its data. This cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteModal(false)} className="flex-1 py-2.5 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-600 dark:text-neutral-300 rounded-xl text-sm font-medium transition-colors">Cancel</button>
                <button onClick={deleteDoc} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-colors">Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Helper Components ─── */

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-400 dark:text-neutral-500 text-xs">{label}</span>
      <span className="text-slate-700 dark:text-neutral-200 font-medium text-xs">{value}</span>
    </div>
  );
}

function StatBox({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="p-3 bg-slate-50 dark:bg-neutral-800 rounded-xl text-center">
      <Icon size={16} className="text-slate-400 dark:text-neutral-500 mx-auto mb-1.5" />
      <p className="text-lg font-bold text-slate-800 dark:text-white">{value}</p>
      <p className="text-[10px] text-slate-500 dark:text-neutral-400">{label}</p>
    </div>
  );
}

function AnalyticCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  const colors: Record<string, { bg: string; iconBg: string; text: string }> = {
    blue:  { bg: "bg-blue-50 dark:bg-blue-950/40",  iconBg: "bg-blue-100 dark:bg-blue-900/50",  text: "text-blue-600 dark:text-blue-400" },
    mint:  { bg: "bg-mint-50 dark:bg-mint-950/40",  iconBg: "bg-mint-100 dark:bg-mint-900/50",  text: "text-mint-700 dark:text-mint-400" },
    amber: { bg: "bg-amber-50 dark:bg-amber-950/40", iconBg: "bg-amber-100 dark:bg-amber-900/50", text: "text-amber-600 dark:text-amber-400" },
  };
  const c = colors[color] || colors.blue;
  return (
    <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5">
      <div className={`w-10 h-10 ${c.iconBg} rounded-xl flex items-center justify-center mb-3`}>
        <Icon size={18} className={c.text} />
      </div>
      <p className="text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
      <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">{label}</p>
    </div>
  );
}
