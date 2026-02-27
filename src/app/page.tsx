"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Upload, Users, Pen, BarChart2,
  MoreHorizontal, Eye, Download, BarChart3, Edit3, Copy, Share2, Trash2, X, Check,
  Search, LayoutGrid, List,
  Clock, CheckCircle2, FileEdit, Bell, Menu,
  TrendingUp, TrendingDown, File, Activity, Calendar,
  Settings, LogOut, ChevronLeft, ChevronRight, FolderPlus, FolderOpen, Lock,
  Sun, Moon, Monitor
} from "lucide-react";
import toast from "react-hot-toast";
import { useTheme } from "@/lib/theme";
import { useSession, signOut } from "@/lib/auth-client";

/* ─── Status config ─── */
const STATUS: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  DRAFT:            { label: "Draft",       dot: "bg-slate-400",  bg: "bg-slate-100 dark:bg-neutral-800",   text: "text-slate-600 dark:text-neutral-300" },
  SENT:             { label: "Sent",        dot: "bg-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/40",     text: "text-blue-600 dark:text-blue-400" },
  PARTIALLY_SIGNED: { label: "In Progress", dot: "bg-amber-400",  bg: "bg-amber-50 dark:bg-amber-950/40",    text: "text-amber-600 dark:text-amber-400" },
  COMPLETED:        { label: "Completed",   dot: "bg-mint-500",   bg: "bg-mint-50 dark:bg-mint-950/40",     text: "text-mint-700 dark:text-mint-400" },
  DECLINED:         { label: "Declined",    dot: "bg-red-400",    bg: "bg-red-50 dark:bg-red-950/40",      text: "text-red-600 dark:text-red-400" },
  EXPIRED:          { label: "Expired",     dot: "bg-slate-400",  bg: "bg-slate-100 dark:bg-neutral-800",   text: "text-slate-500 dark:text-neutral-400" },
  VOIDED:           { label: "Voided",      dot: "bg-slate-400",  bg: "bg-slate-100 dark:bg-neutral-800",   text: "text-slate-500 dark:text-neutral-400" },
};

const EV_LABELS: Record<string, { label: string; color: string }> = {
  DOCUMENT_CREATED:  { label: "Created",        color: "text-slate-500" },
  DOCUMENT_SENT:     { label: "Sent",           color: "text-blue-500" },
  DOCUMENT_VOIDED:   { label: "Voided",         color: "text-red-500" },
  DOCUMENT_COMPLETED:{ label: "Completed",      color: "text-mint-600 dark:text-mint-400" },
  EMAIL_SENT:        { label: "Email Sent",     color: "text-blue-500" },
  RECIPIENT_VIEWED:  { label: "Viewed",         color: "text-amber-500" },
  RECIPIENT_SIGNED:  { label: "Signed",         color: "text-mint-600 dark:text-mint-400" },
  RECIPIENT_DECLINED:{ label: "Declined",       color: "text-red-500" },
  FIELD_SIGNED:      { label: "Field Completed",color: "text-mint-500" },
  DOWNLOAD:          { label: "Downloaded",     color: "text-slate-500" },
};

/* ─── Sidebar nav ─── */
const NAV_MAIN = [
  { key: "dashboard",  label: "Dashboard",      icon: BarChart2 },
  { key: "documents",  label: "All Documents",  icon: FileText },
  { key: "shared",     label: "Shared",         icon: Users },
  { key: "deleted",    label: "Deleted Files",  icon: Trash2 },
];

const COMING_SOON_NAV = new Set(["shared"]);

/* ═══════════ Context menu ═══════════ */
function DocMenu({ doc, onAction }: { doc: any; onAction: (a: string, id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  const items = [
    ...(doc.status === "COMPLETED" ? [{ key: "view", icon: Eye, label: "View Signed Doc", danger: false }] : []),
    { key: "download", icon: Download, label: "Download", danger: false },
    { key: "analytics", icon: BarChart3, label: "View Analytics", danger: false },
    { key: "rename", icon: Edit3, label: "Rename", danger: false },
    { key: "copy", icon: Copy, label: "Make a Copy", danger: false },
    { key: "share", icon: Share2, label: "Copy Share Link", danger: false },
    { key: "move", icon: FolderOpen, label: "Move to Category", danger: false },
    { key: "delete", icon: Trash2, label: "Delete", danger: true },
  ];
  return (
    <div ref={ref} className="relative z-20">
      <button onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-700 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300 transition-colors">
        <MoreHorizontal size={16} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -4 }} transition={{ duration: 0.12 }} className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl shadow-lg shadow-slate-200/50 dark:shadow-black/30 overflow-hidden py-1">
            {items.map(item => (
              <button key={item.key} onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(false); onAction(item.key, doc.id); }}
                className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors text-left ${item.danger ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 border-t border-slate-100 dark:border-neutral-700" : "text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-700"}`}>
                <item.icon size={15} />{item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════ Sidebar (collapsible) ═══════════ */
function Sidebar({ activeNav, onNav, onMobileClose, stats, collapsed, onToggle }: {
  activeNav: string; onNav: (k: string) => void; onMobileClose?: () => void;
  stats: { total: number; completed: number; pending: number; drafts: number };
  collapsed: boolean; onToggle: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const expanded = !collapsed || hovered;
  const { theme, setTheme } = useTheme();
  const themeOptions: { key: "light" | "dark" | "system"; icon: typeof Sun; label: string }[] = [
    { key: "light", icon: Sun, label: "Light" },
    { key: "dark", icon: Moon, label: "Dark" },
    { key: "system", icon: Monitor, label: "System" },
  ];

  return (
    <div
      className={`flex flex-col h-full bg-white dark:bg-neutral-900 border-r border-slate-200 dark:border-neutral-800 transition-all duration-200 ${expanded ? "w-[260px]" : "w-[72px]"}`}
      onMouseEnter={() => { if (collapsed) setHovered(true); }}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Logo + collapse toggle */}
      <div className={`h-16 flex items-center border-b border-slate-100 dark:border-neutral-800 ${expanded ? "px-5 gap-2.5" : "px-0 justify-center"}`}>
        <div className="w-9 h-9 bg-gradient-to-br from-mint-400 to-mint-600 rounded-xl flex items-center justify-center shadow-md shadow-mint-200 dark:shadow-mint-900/30 flex-shrink-0">
          <Pen size={16} className="text-white" />
        </div>
        {expanded && <span className="text-xl font-bold text-slate-800 dark:text-white tracking-tight flex-1 whitespace-nowrap overflow-hidden">Pix<span className="text-mint-500">Sign</span></span>}
        {expanded && (
          <button onClick={e => { e.stopPropagation(); onToggle(); }} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300 transition-colors hidden lg:block" title={collapsed ? "Expand" : "Collapse"}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_MAIN.map(item => {
          const active = activeNav === item.key;
          const isComingSoon = COMING_SOON_NAV.has(item.key);
          return (
            <button key={item.key} onClick={() => { onNav(item.key); onMobileClose?.(); }} title={!expanded ? item.label : undefined}
              className={`w-full flex items-center gap-3 rounded-xl text-sm font-medium transition-all ${expanded ? "px-3 py-2.5" : "px-0 py-2.5 justify-center"} ${active && !isComingSoon ? "bg-mint-50 dark:bg-mint-950/40 text-mint-700 dark:text-mint-400" : isComingSoon ? "text-slate-400 dark:text-neutral-600" : "text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-neutral-800 hover:text-slate-700 dark:hover:text-neutral-200"}`}>
              <item.icon size={18} className={`flex-shrink-0 ${active && !isComingSoon ? "text-mint-500" : ""}`} />
              {expanded && <span className="whitespace-nowrap overflow-hidden">{item.label}</span>}
              {expanded && isComingSoon && <Lock size={10} className="ml-auto text-slate-300 dark:text-neutral-600 flex-shrink-0" />}
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className={`pb-3 space-y-3 border-t border-slate-100 dark:border-neutral-800 pt-3 ${expanded ? "px-4" : "px-2"}`}>
        {/* Theme toggle */}
        {expanded ? (
          <div className="bg-slate-100 dark:bg-neutral-800 rounded-xl p-1 flex gap-0.5">
            {themeOptions.map(opt => {
              const active = theme === opt.key;
              return (
                <button key={opt.key} onClick={() => setTheme(opt.key)} title={opt.label}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${active ? "bg-white dark:bg-neutral-700 text-slate-800 dark:text-white shadow-sm" : "text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300"}`}>
                  <opt.icon size={13} />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "dark" : "light")}
            title={`Theme: ${theme}`}
            className="w-full flex justify-center py-2 rounded-xl text-slate-400 dark:text-neutral-500 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-600 dark:hover:text-neutral-300 transition-colors"
          >
            {theme === "dark" ? <Moon size={18} /> : theme === "system" ? <Monitor size={18} /> : <Sun size={18} />}
          </button>
        )}

        {expanded && (
          <div className="bg-slate-50 dark:bg-neutral-800 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <File size={14} className="text-mint-500" />
              <span className="text-xs font-semibold text-slate-700 dark:text-neutral-300">Documents</span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-mint-400 to-mint-500 rounded-full transition-all" style={{ width: `${Math.min((stats.total / Math.max(stats.total, 20)) * 100, 100)}%` }} />
            </div>
            <p className="text-xs text-slate-400 dark:text-neutral-500 mt-1.5">{stats.completed} completed of {stats.total} total</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════ Simple bar chart (pure CSS) ═══════════ */
function MiniBarChart({ data, maxVal }: { data: { label: string; value: number; color: string }[]; maxVal: number }) {
  return (
    <div className="flex items-end gap-1.5 h-32">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <motion.div
            initial={{ height: 0 }} animate={{ height: `${Math.max((d.value / Math.max(maxVal, 1)) * 100, 4)}%` }}
            transition={{ delay: i * 0.05, duration: 0.4 }}
            className={`w-full rounded-t-md ${d.color}`}
          />
          <span className="text-[10px] text-slate-400 dark:text-neutral-500 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════ User dropdown ═══════════ */
function UserDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { data: session } = useSession();
  const userName = session?.user?.name || "PixSign User";
  const userEmail = session?.user?.email || "";

  useEffect(() => {
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initials = userName.split(" ").map(w => w[0]).join("").slice(0, 2) || "PS";

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2.5 pl-3 border-l border-slate-200 dark:border-neutral-700 hover:opacity-80 transition-opacity">
        <img src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(initials)}&backgroundColor=22c55e&textColor=ffffff&fontSize=40`} alt="" className="w-8 h-8 rounded-full" />
        <span className="text-sm font-semibold text-slate-700 dark:text-neutral-200 hidden md:block">{userName}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -4 }} transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl shadow-lg shadow-slate-200/50 dark:shadow-black/30 overflow-hidden py-1 z-50">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-neutral-700">
              <p className="text-sm font-semibold text-slate-700 dark:text-neutral-200">{userName}</p>
              <p className="text-xs text-slate-400 dark:text-neutral-500">{userEmail}</p>
            </div>
            <button onClick={() => { setOpen(false); router.push("/settings"); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-700 transition-colors text-left">
              <Settings size={15} /> Settings
            </button>
            <button onClick={async () => { setOpen(false); await signOut(); router.push("/login"); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left border-t border-slate-100 dark:border-neutral-700">
              <LogOut size={15} /> Log out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════ */
export default function Home() {
  const router = useRouter();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [activeNav, setActiveNav] = useState("dashboard");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  /* Category state — saved to localStorage */
  const [categories, setCategories] = useState<{ id: string; label: string }[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [docCategories, setDocCategories] = useState<Record<string, string>>({}); // docId -> catId
  const [moveDocId, setMoveDocId] = useState<string | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);

  /* Soft-deleted docs — stored in localStorage */
  const [deletedDocIds, setDeletedDocIds] = useState<string[]>([]);

  // Load categories + deleted docs from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pixsign_categories");
      if (saved) setCategories(JSON.parse(saved));
      const savedMap = localStorage.getItem("pixsign_doc_categories");
      if (savedMap) setDocCategories(JSON.parse(savedMap));
      const savedDeleted = localStorage.getItem("pixsign_deleted_docs");
      if (savedDeleted) setDeletedDocIds(JSON.parse(savedDeleted));
    } catch {}
  }, []);

  const saveCategories = useCallback((cats: { id: string; label: string }[]) => {
    setCategories(cats);
    localStorage.setItem("pixsign_categories", JSON.stringify(cats));
  }, []);

  const saveDocCategories = useCallback((map: Record<string, string>) => {
    setDocCategories(map);
    localStorage.setItem("pixsign_doc_categories", JSON.stringify(map));
  }, []);

  function addCategory() {
    if (!newCatName.trim()) return;
    const cat = { id: `cat-${Date.now()}`, label: newCatName.trim() };
    saveCategories([...categories, cat]);
    setNewCatName("");
    setShowNewCat(false);
    toast.success(`Category "${cat.label}" created`);
  }

  function deleteCategory(catId: string) {
    saveCategories(categories.filter(c => c.id !== catId));
    const newMap = { ...docCategories };
    Object.keys(newMap).forEach(k => { if (newMap[k] === catId) delete newMap[k]; });
    saveDocCategories(newMap);
    if (activeCategoryFilter === catId) setActiveCategoryFilter(null);
    toast.success("Category deleted");
  }

  function moveDocToCategory(docId: string, catId: string | null) {
    const newMap = { ...docCategories };
    if (catId) newMap[docId] = catId;
    else delete newMap[docId];
    saveDocCategories(newMap);
    setMoveDocId(null);
    toast.success(catId ? "Document moved" : "Document removed from category");
  }

  function softDeleteDoc(docId: string) {
    const next = [...deletedDocIds, docId];
    setDeletedDocIds(next);
    localStorage.setItem("pixsign_deleted_docs", JSON.stringify(next));
    setDeleteId(null);
    toast.success("Moved to Deleted Files");
  }

  function restoreDoc(docId: string) {
    const next = deletedDocIds.filter(id => id !== docId);
    setDeletedDocIds(next);
    localStorage.setItem("pixsign_deleted_docs", JSON.stringify(next));
    toast.success("Document restored");
  }

  async function permanentlyDeleteDoc(docId: string) {
    const t = toast.loading("Deleting permanently...");
    try {
      await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      const next = deletedDocIds.filter(id => id !== docId);
      setDeletedDocIds(next);
      localStorage.setItem("pixsign_deleted_docs", JSON.stringify(next));
      setDocs(prev => prev.filter(d => d.id !== docId));
      toast.success("Permanently deleted", { id: t });
    } catch { toast.error("Delete failed", { id: t }); }
  }

  function loadDocs() { fetch("/api/documents").then(r => r.json()).then(setDocs).finally(() => setLoading(false)); }
  useEffect(loadDocs, []);
  useEffect(() => { fetch("/api/analytics").then(r => r.json()).then(setAnalyticsData).catch(() => {}); }, []);

  async function upload(file: File) {
    if (file.type !== "application/pdf") { toast.error("PDF only"); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", file.name.replace(".pdf", ""));
    try {
      const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Uploaded!");
      router.push(`/documents/${data.id}/prepare`);
    } catch (e: any) { toast.error(e.message || "Upload failed"); }
    finally { setUploading(false); }
  }

  async function handleAction(action: string, id: string) {
    switch (action) {
      case "view": router.push(`/documents/${id}`); break;
      case "download": window.open(`/api/documents/${id}/download`, "_blank"); break;
      case "analytics": router.push(`/documents/${id}/analytics`); break;
      case "rename": { const doc = docs.find(d => d.id === id); if (doc) { setRenameId(id); setRenameTitle(doc.title); } break; }
      case "copy": {
        const t = toast.loading("Copying...");
        try { const res = await fetch(`/api/documents/${id}/copy`, { method: "POST" }); const data = await res.json(); if (!res.ok) throw new Error(data.error); toast.success("Copy created!", { id: t }); loadDocs(); } catch (e: any) { toast.error(e.message || "Copy failed", { id: t }); }
        break;
      }
      case "share": { await navigator.clipboard.writeText(`${window.location.origin}/share/${id}`); toast.success("Share link copied!"); break; }
      case "move": setMoveDocId(id); break;
      case "delete": setDeleteId(id); setDeleteConfirmText(""); break;
    }
  }

  async function confirmRename() {
    if (!renameId || !renameTitle.trim()) return;
    const t = toast.loading("Renaming...");
    try { await fetch(`/api/documents/${renameId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: renameTitle.trim() }) }); toast.success("Renamed!", { id: t }); setRenameId(null); loadDocs(); } catch { toast.error("Rename failed", { id: t }); }
  }

  function confirmDelete() {
    if (!deleteId) return;
    softDeleteDoc(deleteId);
  }

  const deletedSet = useMemo(() => new Set(deletedDocIds), [deletedDocIds]);
  const activeDocs = useMemo(() => docs.filter(d => !deletedSet.has(d.id)), [docs, deletedSet]);
  const stats = {
    total: activeDocs.length,
    completed: activeDocs.filter(d => d.status === "COMPLETED").length,
    pending: activeDocs.filter(d => ["SENT", "PARTIALLY_SIGNED"].includes(d.status)).length,
    drafts: activeDocs.filter(d => d.status === "DRAFT").length,
  };

  const filteredDocs = useMemo(() => {
    let result = docs.filter(d => !deletedSet.has(d.id));
    if (searchQuery) result = result.filter(d => d.title?.toLowerCase().includes(searchQuery.toLowerCase()));
    if (activeCategoryFilter) result = result.filter(d => docCategories[d.id] === activeCategoryFilter);
    return result;
  }, [docs, searchQuery, activeCategoryFilter, docCategories, deletedSet]);

  const deletedDocs = useMemo(() => docs.filter(d => deletedSet.has(d.id)), [docs, deletedSet]);

  const statusBarSegments = useMemo(() => {
    if (!stats.total) return [];
    const segments = [
      { status: "COMPLETED", count: stats.completed, color: "bg-mint-400", label: "Completed" },
      { status: "PENDING", count: stats.pending, color: "bg-amber-400", label: "Pending" },
      { status: "DRAFT", count: stats.drafts, color: "bg-blue-300", label: "Drafts" },
      { status: "OTHER", count: stats.total - stats.completed - stats.pending - stats.drafts, color: "bg-slate-300 dark:bg-neutral-600", label: "Other" },
    ];
    return segments.filter(s => s.count > 0);
  }, [stats]);

  const monthlyActivity = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const counts = new Array(12).fill(0);
    if (analyticsData?.timeline) {
      for (const ev of analyticsData.timeline) { const m = new Date(ev.createdAt).getMonth(); counts[m]++; }
    }
    for (const d of docs) { const m = new Date(d.createdAt).getMonth(); counts[m]++; }
    return months.map((label, i) => ({ label, value: counts[i], color: "bg-mint-400" }));
  }, [analyticsData, docs]);

  const isDashboard = activeNav === "dashboard";
  const isDeletedView = activeNav === "deleted";

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-neutral-950 overflow-hidden">
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 flex-shrink-0 transform transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <Sidebar activeNav={activeNav} onNav={(k) => {
        if (COMING_SOON_NAV.has(k)) { toast("Coming soon!", { icon: "🚧" }); return; }
        setActiveNav(k);
      }} onMobileClose={() => setSidebarOpen(false)} stats={stats} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-white dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800 flex items-center gap-4 px-6 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800">
            <Menu size={20} className="text-slate-600 dark:text-neutral-300" />
          </button>
          <h1 className="text-base font-semibold text-slate-800 dark:text-white">{isDashboard ? "Dashboard" : activeNav === "documents" ? "All Documents" : NAV_MAIN.find(n => n.key === activeNav)?.label || "Documents"}</h1>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search documents..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-64 pl-9 pr-4 py-2 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-sm text-slate-700 dark:text-neutral-200 placeholder:text-slate-400 dark:placeholder:text-neutral-500 outline-none focus:border-mint-400 focus:bg-white dark:focus:bg-neutral-800 focus:ring-2 focus:ring-mint-100 dark:focus:ring-mint-900/30 transition-all" />
            </div>
            <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300 transition-colors relative">
              <Bell size={18} />
            </button>
            <UserDropdown />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6"
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={e => { if (e.currentTarget === e.target) setDragOver(false); }}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) upload(f); }}>

          {/* Drag overlay */}
          {dragOver && (
            <div className="fixed inset-0 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-dashed border-mint-400 rounded-2xl p-20 text-center bg-mint-50/50 dark:bg-mint-950/30">
                <Upload size={48} className="mx-auto mb-4 text-mint-500" />
                <p className="text-mint-600 dark:text-mint-400 font-semibold text-lg">Drop PDF to upload</p>
              </div>
            </div>
          )}

          <input id="file-upload" type="file" accept=".pdf" className="hidden" disabled={uploading} onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />

          <div className="max-w-7xl mx-auto">
          {/* ═══════════ DASHBOARD VIEW ═══════════ */}
          {isDashboard && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Completed", value: stats.completed, icon: CheckCircle2, trend: stats.completed > 0 ? `+${Math.round((stats.completed / Math.max(stats.total, 1)) * 100)}%` : "0%", up: true, color: "text-mint-500" },
                  { label: "Pending", value: stats.pending, icon: Clock, trend: stats.pending > 0 ? `${stats.pending} active` : "None", up: false, color: "text-amber-500" },
                  { label: "Drafts", value: stats.drafts, icon: FileEdit, trend: stats.drafts > 0 ? `${stats.drafts} drafts` : "None", up: false, color: "text-blue-500" },
                  { label: "Others", value: Math.max(stats.total - stats.completed - stats.pending - stats.drafts, 0), icon: FileText, trend: "Expired / Voided", up: false, color: "text-slate-400" },
                ].map((s, i) => (
                  <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                    className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5 hover:shadow-md hover:shadow-slate-100 dark:hover:shadow-black/20 transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <s.icon size={16} className={s.color} />
                        <span className="text-sm text-slate-500 dark:text-neutral-400 font-medium">{s.label}</span>
                      </div>
                    </div>
                    <div className="flex items-end justify-between mt-3">
                      <span className="text-3xl font-bold text-slate-800 dark:text-white">{s.value}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${s.up ? "text-mint-600 dark:text-mint-400 bg-mint-50 dark:bg-mint-950/40" : "text-slate-400 bg-slate-50 dark:bg-neutral-800"}`}>
                        {s.up && <TrendingUp size={10} />}
                        {!s.up && s.trend.includes("None") ? "" : !s.up && <TrendingDown size={10} />}
                        {s.trend}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-400 dark:text-neutral-500">
                      <Calendar size={10} /><span>{new Date().getFullYear()}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold text-slate-800 dark:text-white">PixSign Document Space</h2>
                  <span className="text-sm text-slate-500 dark:text-neutral-400">Using <strong className="text-slate-700 dark:text-neutral-200">{stats.total}</strong> documents</span>
                </div>
                {stats.total > 0 ? (
                  <>
                    <div className="flex h-5 rounded-full overflow-hidden bg-slate-100 dark:bg-neutral-800 mb-3">
                      {statusBarSegments.map((seg, i) => (
                        <motion.div key={seg.status} initial={{ width: 0 }} animate={{ width: `${(seg.count / stats.total) * 100}%` }}
                          transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
                          className={`${seg.color} first:rounded-l-full last:rounded-r-full`} />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs">
                      {statusBarSegments.map(seg => (
                        <div key={seg.status} className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${seg.color}`} />
                          <span className="text-slate-500 dark:text-neutral-400">{seg.label} ({seg.count})</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-400 dark:text-neutral-500">No documents yet. Upload your first PDF to get started.</p>
                )}
              </motion.div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className="lg:col-span-2 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-slate-800 dark:text-white">Document Activity</h2>
                    <div className="flex items-center bg-slate-100 dark:bg-neutral-800 rounded-lg p-0.5 text-xs font-medium">
                      <span className="px-3 py-1 rounded-md bg-white dark:bg-neutral-700 text-mint-600 dark:text-mint-400 shadow-sm">12 Months</span>
                    </div>
                  </div>
                  <MiniBarChart data={monthlyActivity} maxVal={Math.max(...monthlyActivity.map(m => m.value), 1)} />
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                  className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5">
                  <h2 className="text-base font-semibold text-slate-800 dark:text-white mb-4">Signing Summary</h2>
                  <div className="space-y-4">
                    {[
                      { label: "Total Signers", value: analyticsData?.stats?.totalSigners ?? 0, color: "bg-mint-400" },
                      { label: "Signed", value: analyticsData?.stats?.signedSigners ?? 0, color: "bg-mint-500" },
                      { label: "Total Fields", value: analyticsData?.stats?.totalFields ?? 0, color: "bg-blue-400" },
                      { label: "Fields Done", value: analyticsData?.stats?.completedFields ?? 0, color: "bg-blue-500" },
                    ].map(item => {
                      const max = Math.max(analyticsData?.stats?.totalSigners ?? 0, analyticsData?.stats?.totalFields ?? 0, 1);
                      return (
                        <div key={item.label}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-slate-500 dark:text-neutral-400">{item.label}</span>
                            <span className="text-sm font-bold text-slate-700 dark:text-neutral-200">{item.value}</span>
                          </div>
                          <div className="h-2 bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
                              transition={{ duration: 0.5 }} className={`h-full rounded-full ${item.color}`} />
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-2 border-t border-slate-100 dark:border-neutral-800">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 dark:text-neutral-400">Completion Rate</span>
                        <span className="text-lg font-bold text-mint-600 dark:text-mint-400">{analyticsData?.stats?.completionRate ?? 0}%</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-neutral-800">
                  <h2 className="text-base font-semibold text-slate-800 dark:text-white">Recent Activity</h2>
                </div>
                {analyticsData?.timeline?.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-neutral-800">
                    {analyticsData.timeline.slice(0, 10).map((ev: any) => {
                      const cfg = EV_LABELS[ev.type] || { label: ev.type, color: "text-slate-500" };
                      return (
                        <div key={ev.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50/50 dark:hover:bg-neutral-800/50 transition-colors">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            ev.type.includes("SIGNED") || ev.type.includes("COMPLETED") ? "bg-mint-50 dark:bg-mint-950/40" :
                            ev.type.includes("SENT") || ev.type.includes("EMAIL") ? "bg-blue-50 dark:bg-blue-950/40" :
                            ev.type.includes("DECLINED") || ev.type.includes("VOIDED") ? "bg-red-50 dark:bg-red-950/40" : "bg-slate-50 dark:bg-neutral-800"
                          }`}>
                            <Activity size={14} className={cfg.color} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</p>
                            {ev.docTitle && <p className="text-xs text-slate-400 dark:text-neutral-500 truncate">{ev.docTitle}</p>}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-slate-400 dark:text-neutral-500">{new Date(ev.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                            <p className="text-[10px] text-slate-300 dark:text-neutral-600">{new Date(ev.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-5 py-8 text-center text-sm text-slate-400 dark:text-neutral-500">No activity yet</div>
                )}
              </motion.div>
            </div>
          )}

          {/* ═══════════ DELETED FILES VIEW ═══════════ */}
          {isDeletedView && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-base font-semibold text-slate-800 dark:text-white">Deleted Files</h2>
                  <p className="text-xs text-slate-400 dark:text-neutral-500 mt-0.5">{deletedDocs.length} document{deletedDocs.length !== 1 ? "s" : ""} in trash</p>
                </div>
              </div>
              {deletedDocs.length > 0 ? (
                <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
                  <div className="grid grid-cols-[1fr_120px_160px_100px] gap-4 px-5 py-3 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-800/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <span>Name</span><span>Status</span><span>Deleted</span><span>Actions</span>
                  </div>
                  {deletedDocs.map((doc, i) => {
                    const cfg = STATUS[doc.status] || STATUS.DRAFT;
                    return (
                      <motion.div key={doc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                        className="grid grid-cols-[1fr_120px_160px_100px] gap-4 items-center px-5 py-3.5 border-b border-slate-100 dark:border-neutral-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-neutral-800/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 bg-red-50 dark:bg-red-950/30 rounded-lg flex items-center justify-center flex-shrink-0"><FileText size={15} className="text-red-400" /></div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700 dark:text-neutral-200 truncate">{doc.title}</p>
                            <p className="text-xs text-slate-400 dark:text-neutral-500">PDF</p>
                          </div>
                        </div>
                        <div>
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 dark:text-neutral-500">{new Date(doc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => restoreDoc(doc.id)} title="Restore" className="px-2.5 py-1.5 bg-mint-50 dark:bg-mint-950/40 hover:bg-mint-100 dark:hover:bg-mint-900/40 text-mint-700 dark:text-mint-400 rounded-lg text-xs font-medium transition-colors">
                            Restore
                          </button>
                          <button onClick={() => permanentlyDeleteDoc(doc.id)} title="Delete permanently" className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-20 bg-white dark:bg-neutral-900 border border-dashed border-slate-200 dark:border-neutral-800 rounded-2xl">
                  <Trash2 size={40} className="mx-auto mb-3 text-slate-200 dark:text-neutral-700" />
                  <p className="text-slate-500 dark:text-neutral-400 font-medium">Trash is empty</p>
                  <p className="text-slate-400 dark:text-neutral-500 text-sm mt-1">Deleted documents will appear here</p>
                </div>
              )}
            </div>
          )}

          {/* ═══════════ DOCUMENTS VIEW ═══════════ */}
          {!isDashboard && !isDeletedView && (
            <>
              {/* Action bar — only Upload or Drop is active */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-8">
                {[
                  { label: "Upload or Drop", icon: Upload, active: true, action: () => document.querySelector<HTMLInputElement>('#file-upload')?.click() },
                  { label: "Templates", icon: FileEdit, active: false },
                  { label: "Edit PDF", icon: Edit3, active: false },
                  { label: "Get Signatures", icon: Pen, active: false },
                  { label: "Sign Yourself", icon: CheckCircle2, active: false },
                ].map((item, i) => (
                  <motion.button key={item.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    onClick={item.active ? item.action : () => toast("Coming soon!", { icon: "🚧" })}
                    disabled={uploading && item.active}
                    className={`flex flex-col items-center justify-center gap-2 py-5 px-3 rounded-2xl border text-sm font-medium transition-all relative ${
                      item.active
                        ? "bg-gradient-to-br from-mint-500 to-mint-600 text-white border-mint-500 shadow-lg shadow-mint-200 dark:shadow-mint-900/30 hover:shadow-xl hover:shadow-mint-200 dark:hover:shadow-mint-900/40 hover:scale-[1.02]"
                        : "bg-white dark:bg-neutral-900 text-slate-400 dark:text-neutral-500 border-slate-200 dark:border-neutral-800 cursor-default opacity-70"
                    }`}>
                    {!item.active && (
                      <div className="absolute top-2 right-2">
                        <Lock size={10} className="text-slate-300 dark:text-neutral-600" />
                      </div>
                    )}
                    {uploading && item.active ? <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <item.icon size={22} />}
                    <span>{uploading && item.active ? "Uploading..." : item.label}</span>
                    {!item.active && <span className="text-[10px] text-slate-400 dark:text-neutral-600 -mt-1">Coming soon</span>}
                  </motion.button>
                ))}
              </div>

              {/* Categories — user-created */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-slate-800 dark:text-white">Categories</h2>
                  <div className="flex items-center gap-2">
                    {activeCategoryFilter && (
                      <button onClick={() => setActiveCategoryFilter(null)} className="text-xs text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 px-2 py-1 border border-slate-200 dark:border-neutral-700 rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors">
                        Clear filter
                      </button>
                    )}
                    <button onClick={() => setShowNewCat(true)} className="text-sm text-mint-600 dark:text-mint-400 hover:text-mint-700 font-medium px-3 py-1 border border-mint-200 dark:border-mint-800 rounded-lg hover:bg-mint-50 dark:hover:bg-mint-950/30 transition-colors flex items-center gap-1.5">
                      <FolderPlus size={14} /> New Category
                    </button>
                  </div>
                </div>

                {/* New category input */}
                <AnimatePresence>
                  {showNewCat && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-4">
                      <div className="flex items-center gap-2">
                        <input autoFocus value={newCatName} onChange={e => setNewCatName(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") addCategory(); if (e.key === "Escape") setShowNewCat(false); }}
                          placeholder="Category name..."
                          className="flex-1 px-3 py-2 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-sm text-slate-700 dark:text-neutral-200 placeholder:text-slate-400 dark:placeholder:text-neutral-500 outline-none focus:border-mint-400 focus:ring-2 focus:ring-mint-100 dark:focus:ring-mint-900/30" />
                        <button onClick={addCategory} className="px-4 py-2 bg-mint-500 hover:bg-mint-600 text-white rounded-xl text-sm font-medium transition-colors">Create</button>
                        <button onClick={() => { setShowNewCat(false); setNewCatName(""); }} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300"><X size={16} /></button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {categories.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {categories.map((cat, i) => {
                      const count = Object.values(docCategories).filter(c => c === cat.id).length;
                      const isActive = activeCategoryFilter === cat.id;
                      return (
                        <motion.div key={cat.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.04 }}
                          onClick={() => setActiveCategoryFilter(isActive ? null : cat.id)}
                          className={`bg-white dark:bg-neutral-900 border rounded-2xl p-5 cursor-pointer transition-all group relative ${isActive ? "border-mint-400 shadow-md shadow-mint-100 dark:shadow-mint-900/20 bg-mint-50/30 dark:bg-mint-950/20" : "border-slate-200 dark:border-neutral-800 hover:shadow-md hover:shadow-slate-100 dark:hover:shadow-black/20"}`}>
                          <button onClick={e => { e.stopPropagation(); deleteCategory(cat.id); }}
                            className="absolute top-2 right-2 p-1 rounded-lg text-slate-300 dark:text-neutral-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-all">
                            <X size={12} />
                          </button>
                          <div className="w-16 h-16 mx-auto mb-3">
                            <svg viewBox="0 0 80 64" className="w-full h-full">
                              <path d="M4 8C4 5.79 5.79 4 8 4H28L36 12H72C74.21 12 76 13.79 76 16V56C76 58.21 74.21 60 72 60H8C5.79 60 4 58.21 4 56V8Z" className={`${isActive ? "fill-mint-300" : "fill-mint-200 dark:fill-mint-900"} group-hover:fill-mint-300 dark:group-hover:fill-mint-800 transition-colors`} />
                              <path d="M4 20H76V56C76 58.21 74.21 60 72 60H8C5.79 60 4 58.21 4 56V20Z" className={`${isActive ? "fill-mint-500" : "fill-mint-400 dark:fill-mint-700"} group-hover:fill-mint-500 dark:group-hover:fill-mint-600 transition-colors`} />
                            </svg>
                          </div>
                          <h3 className="text-sm font-semibold text-slate-700 dark:text-neutral-200 text-center">{cat.label}</h3>
                          <p className="text-xs text-slate-400 dark:text-neutral-500 text-center mt-0.5">{count} document{count !== 1 ? "s" : ""}</p>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-white dark:bg-neutral-900 border border-dashed border-slate-200 dark:border-neutral-800 rounded-2xl">
                    <FolderOpen size={32} className="mx-auto mb-2 text-slate-300 dark:text-neutral-600" />
                    <p className="text-sm text-slate-400 dark:text-neutral-500">No categories yet. Create one to organize your documents.</p>
                  </div>
                )}
              </div>

              {/* Document list */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-slate-800 dark:text-white">
                    {activeCategoryFilter ? categories.find(c => c.id === activeCategoryFilter)?.label || "Documents" : "All Documents"}
                  </h2>
                  <div className="flex items-center bg-slate-100 dark:bg-neutral-800 rounded-lg p-0.5">
                    <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-white dark:bg-neutral-700 text-mint-600 dark:text-mint-400 shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300"}`}><List size={15} /></button>
                    <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-white dark:bg-neutral-700 text-mint-600 dark:text-mint-400 shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300"}`}><LayoutGrid size={15} /></button>
                  </div>
                </div>

                {!loading && docs.length === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    onClick={() => document.querySelector<HTMLInputElement>('#file-upload')?.click()}
                    className={`border-2 border-dashed rounded-2xl p-20 text-center cursor-pointer transition-all ${dragOver ? "border-mint-400 bg-mint-50/50 dark:bg-mint-950/20" : "border-slate-200 dark:border-neutral-700 hover:border-mint-300 hover:bg-mint-50/20 dark:hover:bg-mint-950/10"}`}>
                    <Upload size={40} className={`mx-auto mb-4 ${dragOver ? "text-mint-500" : "text-slate-300 dark:text-neutral-600"}`} />
                    <p className="text-slate-500 dark:text-neutral-400 font-medium">Drop PDF here or click to upload</p>
                    <p className="text-slate-400 dark:text-neutral-500 text-sm mt-1">Up to 50MB</p>
                  </motion.div>
                )}

                {loading && (
                  <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-slate-100 dark:border-neutral-800 last:border-0">
                        <div className="w-8 h-8 bg-slate-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
                        <div className="flex-1 space-y-2"><div className="h-4 bg-slate-100 dark:bg-neutral-800 rounded-lg w-48 animate-pulse" /><div className="h-3 bg-slate-50 dark:bg-neutral-800/50 rounded-lg w-32 animate-pulse" /></div>
                      </div>
                    ))}
                  </div>
                )}

                {/* LIST VIEW */}
                {!loading && filteredDocs.length > 0 && viewMode === "list" && (
                  <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
                    <div className="grid grid-cols-[1fr_120px_120px_130px_40px] gap-4 px-5 py-3 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-800/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <span>Name</span><span className="hidden sm:block">Status</span><span className="hidden md:block">Signers</span><span className="hidden md:block">Last Modified</span><span></span>
                    </div>
                    <AnimatePresence>
                      {filteredDocs.map((doc, i) => {
                        const signers = doc.recipients?.filter((r: any) => r.role === "SIGNER") || [];
                        const cfg = STATUS[doc.status] || STATUS.DRAFT;
                        const isRenaming = renameId === doc.id;
                        const catLabel = docCategories[doc.id] ? categories.find(c => c.id === docCategories[doc.id])?.label : null;
                        return (
                          <motion.div key={doc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                            className="grid grid-cols-[1fr_120px_120px_130px_40px] gap-4 items-center px-5 py-3.5 border-b border-slate-100 dark:border-neutral-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-neutral-800/50 transition-colors group">
                            <Link href={`/documents/${doc.id}`} className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 bg-red-50 dark:bg-red-950/30 rounded-lg flex items-center justify-center flex-shrink-0"><FileText size={15} className="text-red-400" /></div>
                              <div className="min-w-0">
                                {isRenaming ? (
                                  <div className="flex items-center gap-2" onClick={e => e.preventDefault()}>
                                    <input autoFocus value={renameTitle} onChange={e => setRenameTitle(e.target.value)}
                                      onKeyDown={e => { if (e.key === "Enter") confirmRename(); if (e.key === "Escape") setRenameId(null); }}
                                      onClick={e => e.preventDefault()}
                                      className="bg-white dark:bg-neutral-800 border border-mint-300 dark:border-mint-700 rounded-lg px-2 py-1 text-sm text-slate-700 dark:text-neutral-200 font-medium outline-none focus:border-mint-400 focus:ring-2 focus:ring-mint-100 dark:focus:ring-mint-900/30 w-48" />
                                    <button onClick={e => { e.preventDefault(); confirmRename(); }} className="p-1 text-mint-500 hover:bg-mint-50 dark:hover:bg-mint-950/30 rounded"><Check size={14} /></button>
                                    <button onClick={e => { e.preventDefault(); setRenameId(null); }} className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded"><X size={14} /></button>
                                  </div>
                                ) : (
                                  <>
                                    <p className="text-sm font-medium text-slate-700 dark:text-neutral-200 truncate group-hover:text-mint-600 dark:group-hover:text-mint-400 transition-colors">{doc.title}</p>
                                    <p className="text-xs text-slate-400 dark:text-neutral-500">{catLabel ? catLabel : "PDF"}</p>
                                  </>
                                )}
                              </div>
                            </Link>
                            <div className="hidden sm:block">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
                              </span>
                            </div>
                            <div className="hidden md:flex items-center gap-1">
                              {signers.length > 0 ? (
                                <div className="flex -space-x-1.5">
                                  {signers.slice(0, 3).map((r: any) => (
                                    <div key={r.id} title={r.name} className={`w-6 h-6 rounded-full border-2 border-white dark:border-neutral-900 flex items-center justify-center text-[10px] font-bold ${r.status === "SIGNED" ? "bg-mint-500 text-white" : "bg-slate-200 dark:bg-neutral-700 text-slate-500 dark:text-neutral-300"}`}>
                                      {r.name[0].toUpperCase()}
                                    </div>
                                  ))}
                                  {signers.length > 3 && <div className="w-6 h-6 rounded-full border-2 border-white dark:border-neutral-900 bg-slate-100 dark:bg-neutral-700 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-neutral-300">+{signers.length - 3}</div>}
                                </div>
                              ) : <span className="text-xs text-slate-400 dark:text-neutral-500">—</span>}
                            </div>
                            <span className="hidden md:block text-xs text-slate-400 dark:text-neutral-500">{new Date(doc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                            <DocMenu doc={doc} onAction={handleAction} />
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}

                {/* GRID VIEW */}
                {!loading && filteredDocs.length > 0 && viewMode === "grid" && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <AnimatePresence>
                      {filteredDocs.map((doc, i) => {
                        const cfg = STATUS[doc.status] || STATUS.DRAFT;
                        return (
                          <motion.div key={doc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                            <Link href={`/documents/${doc.id}`} className="block bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl overflow-hidden hover:shadow-lg hover:shadow-slate-100 dark:hover:shadow-black/20 transition-all group">
                              <div className="h-40 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-neutral-800 dark:to-neutral-900 flex items-center justify-center border-b border-slate-100 dark:border-neutral-800 relative">
                                <FileText size={40} className="text-slate-200 dark:text-neutral-700" />
                                <div className="absolute top-2 right-2"><DocMenu doc={doc} onAction={handleAction} /></div>
                              </div>
                              <div className="p-4">
                                <p className="text-sm font-medium text-slate-700 dark:text-neutral-200 truncate group-hover:text-mint-600 dark:group-hover:text-mint-400 transition-colors">{doc.title}</p>
                                <div className="flex items-center justify-between mt-2">
                                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
                                  </span>
                                  <span className="text-[11px] text-slate-400 dark:text-neutral-500">{new Date(doc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                                </div>
                              </div>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}

                {!loading && filteredDocs.length === 0 && docs.length > 0 && (
                  <div className="text-center py-16">
                    <Search size={40} className="mx-auto mb-3 text-slate-200 dark:text-neutral-700" />
                    <p className="text-slate-500 dark:text-neutral-400 font-medium">No documents found</p>
                    <p className="text-slate-400 dark:text-neutral-500 text-sm mt-1">Try a different search term</p>
                  </div>
                )}
              </div>
            </>
          )}
          </div>{/* end max-w-7xl */}
        </main>
      </div>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteId && (() => {
          const deleteDoc = docs.find(d => d.id === deleteId);
          const isCompleted = deleteDoc?.status === "COMPLETED";
          const nameMatches = deleteConfirmText.trim() === deleteDoc?.title?.trim();
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setDeleteId(null)}>
              <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} onClick={e => e.stopPropagation()} className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 w-[420px] shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-red-50 dark:bg-red-950/30 rounded-full flex items-center justify-center"><Trash2 size={18} className="text-red-500" /></div>
                  <div><h3 className="font-bold text-slate-800 dark:text-white">Delete Document</h3><p className="text-xs text-slate-400 dark:text-neutral-500">This action cannot be undone</p></div>
                </div>
                {isCompleted ? (
                  <>
                    <p className="text-sm text-slate-500 dark:text-neutral-400 mb-3">This document has been <strong className="text-mint-600 dark:text-mint-400">signed and completed</strong>. To confirm deletion, type the document name below:</p>
                    <div onClick={() => { navigator.clipboard.writeText(deleteDoc?.title || ""); toast.success("Name copied!"); }}
                      className="flex items-center gap-2 px-3 py-2 mb-3 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg cursor-pointer hover:border-slate-300 dark:hover:border-neutral-600 transition-colors group">
                      <span className="text-sm text-slate-700 dark:text-neutral-200 font-semibold truncate flex-1">{deleteDoc?.title}</span>
                      <Copy size={13} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-neutral-300 flex-shrink-0 transition-colors" />
                    </div>
                    <input autoFocus value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && nameMatches) confirmDelete(); }}
                      placeholder="Type document name to confirm..."
                      className="w-full px-3 py-2.5 mb-5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg text-sm text-slate-700 dark:text-neutral-200 placeholder:text-slate-400 dark:placeholder:text-neutral-500 outline-none focus:border-red-300 dark:focus:border-red-700 focus:ring-2 focus:ring-red-50 dark:focus:ring-red-900/30 transition-colors" />
                  </>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-neutral-400 mb-6">Are you sure you want to permanently delete <strong className="text-slate-800 dark:text-white">{deleteDoc?.title}</strong>?</p>
                )}
                <div className="flex gap-3">
                  <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-600 dark:text-neutral-300 rounded-xl text-sm font-medium transition-colors">Cancel</button>
                  <button onClick={confirmDelete} disabled={isCompleted && !nameMatches}
                    className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed">Delete</button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Move to Category modal */}
      <AnimatePresence>
        {moveDocId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setMoveDocId(null)}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} onClick={e => e.stopPropagation()} className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 w-[380px] shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-mint-50 dark:bg-mint-950/30 rounded-full flex items-center justify-center"><FolderOpen size={18} className="text-mint-500" /></div>
                <div><h3 className="font-bold text-slate-800 dark:text-white">Move to Category</h3><p className="text-xs text-slate-400 dark:text-neutral-500">Choose a category for this document</p></div>
              </div>
              <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                {docCategories[moveDocId] && (
                  <button onClick={() => moveDocToCategory(moveDocId, null)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-neutral-700 hover:border-red-300 dark:hover:border-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 text-sm text-red-500 transition-all">
                    <X size={16} /> Remove from category
                  </button>
                )}
                {categories.length > 0 ? categories.map(cat => (
                  <button key={cat.id} onClick={() => moveDocToCategory(moveDocId, cat.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-all ${
                      docCategories[moveDocId] === cat.id ? "border-mint-400 dark:border-mint-700 bg-mint-50 dark:bg-mint-950/30 text-mint-700 dark:text-mint-400" : "border-slate-200 dark:border-neutral-700 hover:border-mint-300 dark:hover:border-mint-700 hover:bg-mint-50/30 dark:hover:bg-mint-950/20 text-slate-600 dark:text-neutral-300"
                    }`}>
                    <FolderOpen size={16} className={docCategories[moveDocId] === cat.id ? "text-mint-500" : "text-slate-400"} />
                    {cat.label}
                    {docCategories[moveDocId] === cat.id && <Check size={14} className="ml-auto text-mint-500" />}
                  </button>
                )) : (
                  <p className="text-sm text-slate-400 dark:text-neutral-500 text-center py-4">No categories yet. Create one first.</p>
                )}
              </div>
              <button onClick={() => setMoveDocId(null)} className="w-full px-4 py-2.5 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-600 dark:text-neutral-300 rounded-xl text-sm font-medium transition-colors">Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
