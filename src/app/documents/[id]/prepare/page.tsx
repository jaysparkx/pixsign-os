"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Save, Plus, X, ChevronLeft, ChevronRight,
  PenTool, Calendar, Type, CheckSquare, Mail, User, Hash, GripVertical,
} from "lucide-react";
import toast from "react-hot-toast";

/* ─── Field type definitions ─── */
const FIELD_DEFS = [
  { type: "SIGNATURE", label: "Signature", icon: PenTool,     color: "#22c55e", w: 200, h: 60 },
  { type: "INITIALS",  label: "Initials",  icon: Hash,        color: "#f97316", w: 90,  h: 44 },
  { type: "DATE",      label: "Date",      icon: Calendar,    color: "#3b82f6", w: 140, h: 38 },
  { type: "TEXT",      label: "Text",      icon: Type,        color: "#8b5cf6", w: 200, h: 38 },
  { type: "CHECKBOX",  label: "Checkbox",  icon: CheckSquare, color: "#14b8a6", w: 28,  h: 28 },
  { type: "NAME",      label: "Full Name", icon: User,        color: "#eab308", w: 160, h: 38 },
  { type: "EMAIL",     label: "Email",     icon: Mail,        color: "#06b6d4", w: 200, h: 38 },
] as const;

const REC_COLORS = ["#22c55e", "#3b82f6", "#f97316", "#8b5cf6", "#06b6d4", "#ec4899"];

/* ─── Types ─── */
interface Field {
  id: string; page: number; x: number; y: number;
  width: number; height: number; type: string;
  recipientId: string | null; required: boolean;
}
interface Rec { id: string; name: string; email: string; role: string; }

type Drag =
  | { mode: "move"; fid: string; ox: number; oy: number }
  | { mode: "resize"; fid: string; handle: string; sx: number; sy: number; orig: Field }
  | { mode: "place-pending"; ftype: string; sx: number; sy: number }
  | { mode: "place-active"; ftype: string; w: number; h: number }
  | null;

/* ─── Component ─── */
export default function PreparePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  /* State */
  const [doc, setDoc] = useState<any>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pg, setPg] = useState(1);
  const [totalPg, setTotalPg] = useState(1);
  const [pdfImgs, setPdfImgs] = useState<string[]>([]);
  const [pdfW, setPdfW] = useState(612);
  const [pdfH, setPdfH] = useState(792);
  const [scale, setScale] = useState(1);
  const [selId, setSelId] = useState<string | null>(null);
  const [selRec, setSelRec] = useState<string | null>(null);
  const [tab, setTab] = useState<"fields" | "recipients">("fields");
  const [newR, setNewR] = useState({ name: "", email: "", role: "SIGNER" });
  const [addingR, setAddingR] = useState(false);
  const [drag, setDrag] = useState<Drag>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);

  /* Refs */
  const scrollRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  /* ─── Data loading ─── */
  useEffect(() => {
    (async () => {
      try {
        const [d, f, r] = await Promise.all([
          fetch(`/api/documents/${id}`).then(r => r.json()),
          fetch(`/api/documents/${id}/fields`).then(r => r.json()),
          fetch(`/api/documents/${id}/recipients`).then(r => r.json()),
        ]);
        setDoc(d); setFields(f); setRecs(r);
        if (r.length) setSelRec(r[0].id);
        await renderPdf(d.pdfUrl);
      } catch { toast.error("Failed to load document"); }
      setLoading(false);
    })();
  }, [id]);

  /* ─── PDF rendering ─── */
  async function renderPdf(path: string) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
    try {
      const pdf = await pdfjs.getDocument(path).promise;
      setTotalPg(pdf.numPages);
      const imgs: string[] = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const p = await pdf.getPage(n);
        const vp = p.getViewport({ scale: 2 });
        if (n === 1) { setPdfW(vp.width / 2); setPdfH(vp.height / 2); }
        const c = document.createElement("canvas");
        c.width = vp.width; c.height = vp.height;
        await p.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
        imgs.push(c.toDataURL("image/jpeg", 0.92));
      }
      setPdfImgs(imgs);
    } catch (e) { console.error("PDF render error:", e); toast.error("Failed to render PDF"); }
  }

  /* ─── Scale ─── */
  useEffect(() => {
    if (!scrollRef.current) return;
    const calc = () => {
      if (!scrollRef.current) return;
      setScale(Math.min((scrollRef.current.clientWidth - 64) / pdfW, 1.5));
    };
    const obs = new ResizeObserver(calc);
    obs.observe(scrollRef.current);
    calc();
    return () => obs.disconnect();
  }, [pdfW]);

  /* ─── Coordinate helper ─── */
  const toLocal = useCallback((cx: number, cy: number) => {
    if (!pdfRef.current) return { x: 0, y: 0 };
    const r = pdfRef.current.getBoundingClientRect();
    return { x: (cx - r.left) / scale, y: (cy - r.top) / scale };
  }, [scale]);

  /* ─── Global drag handler ─── */
  useEffect(() => {
    if (!drag) return;

    const onMove = (e: MouseEvent) => {
      e.preventDefault();
      if (!drag) return;

      switch (drag.mode) {
        case "place-pending": {
          if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 5) {
            const ft = FIELD_DEFS.find(f => f.type === drag.ftype)!;
            setDrag({ mode: "place-active", ftype: drag.ftype, w: ft.w, h: ft.h });
            setGhost({ x: e.clientX, y: e.clientY });
          }
          break;
        }
        case "place-active": {
          setGhost({ x: e.clientX, y: e.clientY });
          break;
        }
        case "move": {
          const { x, y } = toLocal(e.clientX, e.clientY);
          setFields(prev => prev.map(f => {
            if (f.id !== drag.fid) return f;
            return {
              ...f,
              x: Math.max(0, Math.min(x - drag.ox, pdfW - f.width)),
              y: Math.max(0, Math.min(y - drag.oy, pdfH - f.height)),
            };
          }));
          break;
        }
        case "resize": {
          const { x, y } = toLocal(e.clientX, e.clientY);
          const dx = x - drag.sx, dy = y - drag.sy;
          const o = drag.orig;
          const h = drag.handle;
          const MIN = 20;
          let nx = o.x, ny = o.y, nw = o.width, nh = o.height;
          if (h.includes("e")) nw = Math.max(MIN, o.width + dx);
          if (h.includes("w")) { const d = Math.min(dx, o.width - MIN); nx = o.x + d; nw = o.width - d; }
          if (h.includes("s")) nh = Math.max(MIN, o.height + dy);
          if (h.includes("n")) { const d = Math.min(dy, o.height - MIN); ny = o.y + d; nh = o.height - d; }
          nx = Math.max(0, nx); ny = Math.max(0, ny);
          nw = Math.min(nw, pdfW - nx); nh = Math.min(nh, pdfH - ny);
          setFields(prev => prev.map(f => f.id === drag.fid ? { ...f, x: nx, y: ny, width: nw, height: nh } : f));
          break;
        }
      }
    };

    const onUp = (e: MouseEvent) => {
      if (drag.mode === "place-pending") {
        addFieldAtCenter(drag.ftype);
      }
      if (drag.mode === "place-active" && pdfRef.current) {
        const r = pdfRef.current.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          const { x, y } = toLocal(e.clientX, e.clientY);
          const ft = FIELD_DEFS.find(f => f.type === drag.ftype)!;
          const nf: Field = {
            id: `tmp-${Date.now()}`, page: pg,
            x: Math.max(0, Math.min(x - ft.w / 2, pdfW - ft.w)),
            y: Math.max(0, Math.min(y - ft.h / 2, pdfH - ft.h)),
            width: ft.w, height: ft.h, type: drag.ftype,
            recipientId: selRec, required: true,
          };
          setFields(prev => [...prev, nf]);
          setSelId(nf.id);
        }
        setGhost(null);
      }
      setDrag(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, toLocal, pdfW, pdfH, pg, selRec]);

  /* ─── Keyboard shortcuts ─── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if ((e.key === "Delete" || e.key === "Backspace") && selId) {
        e.preventDefault();
        setFields(prev => prev.filter(f => f.id !== selId));
        setSelId(null);
      }
      if (e.key === "Escape") setSelId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selId]);

  /* ─── Helpers ─── */
  const recColor = (rid: string | null) => {
    if (!rid) return "#94a3b8";
    const i = recs.findIndex(r => r.id === rid);
    return REC_COLORS[i >= 0 ? i % REC_COLORS.length : 0];
  };

  function addFieldAtCenter(type: string) {
    const ft = FIELD_DEFS.find(f => f.type === type)!;
    let cx = pdfW / 2 - ft.w / 2;
    let cy = pdfH / 2 - ft.h / 2;
    // Try to use visible center
    if (scrollRef.current && pdfRef.current) {
      const sr = scrollRef.current.getBoundingClientRect();
      const pr = pdfRef.current.getBoundingClientRect();
      const vcx = (Math.max(pr.left, sr.left) + Math.min(pr.right, sr.right)) / 2;
      const vcy = (Math.max(pr.top, sr.top) + Math.min(pr.bottom, sr.bottom)) / 2;
      cx = (vcx - pr.left) / scale - ft.w / 2;
      cy = (vcy - pr.top) / scale - ft.h / 2;
    }
    cx = Math.max(0, Math.min(cx, pdfW - ft.w));
    cy = Math.max(0, Math.min(cy, pdfH - ft.h));
    const nf: Field = { id: `tmp-${Date.now()}`, page: pg, x: cx, y: cy, width: ft.w, height: ft.h, type, recipientId: selRec, required: true };
    setFields(prev => [...prev, nf]);
    setSelId(nf.id);
  }

  function startMove(e: React.MouseEvent, field: Field) {
    e.preventDefault(); e.stopPropagation();
    setSelId(field.id);
    const { x, y } = toLocal(e.clientX, e.clientY);
    setDrag({ mode: "move", fid: field.id, ox: x - field.x, oy: y - field.y });
  }

  function startResize(e: React.MouseEvent, field: Field, handle: string) {
    e.preventDefault(); e.stopPropagation();
    setSelId(field.id);
    const { x, y } = toLocal(e.clientX, e.clientY);
    setDrag({ mode: "resize", fid: field.id, handle, sx: x, sy: y, orig: { ...field } });
  }

  function startPlace(e: React.MouseEvent, ftype: string) {
    e.preventDefault();
    setDrag({ mode: "place-pending", ftype, sx: e.clientX, sy: e.clientY });
  }

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/documents/${id}/fields`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields }) });
      toast.success("Fields saved!");
      router.push(`/documents/${id}`);
    } catch { toast.error("Save failed"); }
    setSaving(false);
  }

  async function addRecipient() {
    if (!newR.name || !newR.email) { toast.error("Name & email required"); return; }
    const res = await fetch(`/api/documents/${id}/recipients`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newR) });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error); return; }
    setRecs(prev => [...prev, data]);
    setSelRec(data.id);
    setNewR({ name: "", email: "", role: "SIGNER" });
    setAddingR(false);
    toast.success("Recipient added!");
  }

  async function removeRec(rid: string) {
    await fetch(`/api/documents/${id}/recipients/${rid}`, { method: "DELETE" });
    setRecs(prev => prev.filter(r => r.id !== rid));
    setFields(prev => prev.map(f => f.recipientId === rid ? { ...f, recipientId: null } : f));
    if (selRec === rid) setSelRec(recs.find(r => r.id !== rid)?.id || null);
  }

  /* ─── Loading ─── */
  if (loading) return (
    <div className="h-screen bg-slate-50 dark:bg-neutral-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-mint-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const pgFields = fields.filter(f => f.page === pg);
  const selField = fields.find(f => f.id === selId);
  const isDragging = drag?.mode === "move" || drag?.mode === "resize";

  /* ─── JSX ─── */
  return (
    <div className={`h-screen bg-slate-50 dark:bg-neutral-950 flex flex-col overflow-hidden ${isDragging ? "select-none" : ""}`}>

      {/* ─── Toolbar ─── */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex-shrink-0 z-50">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <span className="font-semibold text-slate-800 dark:text-white truncate flex-1 text-sm">{doc?.title}</span>
        {totalPg > 1 && (
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-neutral-800 rounded-lg px-1 py-0.5">
            <button onClick={() => setPg(p => Math.max(1, p - 1))} disabled={pg === 1}
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-neutral-700 disabled:opacity-30 text-slate-500 dark:text-neutral-400 transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-slate-500 dark:text-neutral-400 font-medium w-16 text-center">{pg} / {totalPg}</span>
            <button onClick={() => setPg(p => Math.min(totalPg, p + 1))} disabled={pg === totalPg}
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-neutral-700 disabled:opacity-30 text-slate-500 dark:text-neutral-400 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        )}
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-mint-500 hover:bg-mint-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm shadow-mint-500/20">
          {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={15} />}
          Save
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ─── Sidebar ─── */}
        <div className="w-72 border-r border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col flex-shrink-0">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-neutral-800">
            {(["fields", "recipients"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                  tab === t
                    ? "text-mint-600 dark:text-mint-400 border-b-2 border-mint-500 -mb-px"
                    : "text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300"
                }`}>
                {t}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {tab === "fields" ? (
              <>
                {/* Assign to */}
                {recs.length > 0 && (
                  <div className="mb-3">
                    <label className="text-[10px] font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-wider mb-1.5 block">Assign to</label>
                    <select value={selRec || ""} onChange={e => setSelRec(e.target.value || null)}
                      className="w-full px-2.5 py-2 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-sm text-slate-700 dark:text-neutral-200 focus:outline-none focus:border-mint-400 focus:ring-2 focus:ring-mint-100 dark:focus:ring-mint-900/30 transition-all">
                      <option value="">Unassigned</option>
                      {recs.map((r, i) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Field palette */}
                <p className="text-[10px] font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-wider mb-1.5">Drag onto document</p>
                {FIELD_DEFS.map(ft => {
                  const Icon = ft.icon;
                  return (
                    <div key={ft.type}
                      onMouseDown={e => startPlace(e, ft.type)}
                      className="w-full flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-700 border border-slate-100 dark:border-neutral-700 hover:border-slate-200 dark:hover:border-neutral-600 rounded-xl transition-all cursor-grab active:cursor-grabbing group select-none">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: ft.color }} />
                      <Icon size={14} className="text-slate-400 dark:text-neutral-500 group-hover:text-slate-600 dark:group-hover:text-neutral-300 transition-colors flex-shrink-0" />
                      <span className="text-sm text-slate-600 dark:text-neutral-300 flex-1">{ft.label}</span>
                      <GripVertical size={14} className="text-slate-300 dark:text-neutral-600 group-hover:text-slate-400 dark:group-hover:text-neutral-500 transition-colors flex-shrink-0" />
                    </div>
                  );
                })}

                {/* Selected field properties */}
                {selField && (
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-neutral-700 space-y-3">
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Field Properties</p>
                    <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-neutral-800 rounded-lg">
                      <div className="w-3 h-3 rounded-full" style={{ background: FIELD_DEFS.find(f => f.type === selField.type)?.color }} />
                      <span className="text-sm font-medium text-slate-700 dark:text-neutral-200">{FIELD_DEFS.find(f => f.type === selField.type)?.label}</span>
                    </div>
                    <select value={selField.recipientId || ""} onChange={e => setFields(prev => prev.map(f => f.id === selId ? { ...f, recipientId: e.target.value || null } : f))}
                      className="w-full px-2.5 py-2 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-sm text-slate-700 dark:text-neutral-200 focus:outline-none focus:border-mint-400 focus:ring-2 focus:ring-mint-100 dark:focus:ring-mint-900/30 transition-all">
                      <option value="">Unassigned</option>
                      {recs.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-neutral-300 cursor-pointer">
                      <input type="checkbox" checked={selField.required} onChange={e => setFields(prev => prev.map(f => f.id === selId ? { ...f, required: e.target.checked } : f))} className="accent-mint-500 w-4 h-4" />
                      Required
                    </label>
                    <div className="text-[10px] text-slate-400 dark:text-neutral-500">
                      Position: {Math.round(selField.x)}, {Math.round(selField.y)} · Size: {Math.round(selField.width)}×{Math.round(selField.height)}
                    </div>
                    <button onClick={() => { setFields(prev => prev.filter(f => f.id !== selId)); setSelId(null); }}
                      className="w-full py-2 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded-xl text-sm font-medium transition-colors">
                      Delete Field
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {recs.map((r, i) => (
                  <div key={r.id} onClick={() => setSelRec(r.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selRec === r.id
                        ? "border-mint-400 dark:border-mint-700 bg-mint-50/50 dark:bg-mint-950/30"
                        : "border-slate-100 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 hover:border-slate-200 dark:hover:border-neutral-600"
                    }`}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: REC_COLORS[i % REC_COLORS.length] }}>
                        {r.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-700 dark:text-neutral-200 truncate">{r.name}</div>
                        <div className="text-xs text-slate-400 dark:text-neutral-500 truncate">{r.email}</div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); removeRec(r.id); }}
                        className="text-slate-300 dark:text-neutral-600 hover:text-red-500 transition-colors p-1">
                        <X size={13} />
                      </button>
                    </div>
                    <div className="mt-1.5 text-xs text-slate-400 dark:text-neutral-500">
                      {fields.filter(f => f.recipientId === r.id).length} fields · {r.role}
                    </div>
                  </div>
                ))}
                {addingR ? (
                  <div className="p-3 bg-slate-50 dark:bg-neutral-800 border border-mint-200 dark:border-mint-800 rounded-xl space-y-2">
                    <input placeholder="Full name" value={newR.name} onChange={e => setNewR(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-2.5 py-2 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-lg text-sm text-slate-700 dark:text-neutral-200 placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-mint-400 focus:ring-2 focus:ring-mint-100 dark:focus:ring-mint-900/30 transition-all" />
                    <input placeholder="Email" type="email" value={newR.email} onChange={e => setNewR(p => ({ ...p, email: e.target.value }))}
                      className="w-full px-2.5 py-2 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-lg text-sm text-slate-700 dark:text-neutral-200 placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-mint-400 focus:ring-2 focus:ring-mint-100 dark:focus:ring-mint-900/30 transition-all" />
                    <select value={newR.role} onChange={e => setNewR(p => ({ ...p, role: e.target.value }))}
                      className="w-full px-2.5 py-2 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-lg text-sm text-slate-700 dark:text-neutral-200 focus:outline-none focus:border-mint-400 focus:ring-2 focus:ring-mint-100 dark:focus:ring-mint-900/30 transition-all">
                      <option value="SIGNER">Signer</option>
                      <option value="CC">CC only</option>
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => setAddingR(false)}
                        className="flex-1 py-1.5 bg-slate-100 dark:bg-neutral-700 hover:bg-slate-200 dark:hover:bg-neutral-600 text-slate-500 dark:text-neutral-300 rounded-lg text-xs font-medium transition-colors">
                        Cancel
                      </button>
                      <button onClick={addRecipient}
                        className="flex-1 py-1.5 bg-mint-500 hover:bg-mint-600 text-white rounded-lg text-xs font-semibold transition-colors">
                        Add
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAddingR(true)}
                    className="w-full py-2.5 border border-dashed border-slate-200 dark:border-neutral-700 hover:border-mint-300 dark:hover:border-mint-700 rounded-xl text-sm text-slate-400 dark:text-neutral-500 hover:text-mint-600 dark:hover:text-mint-400 flex items-center justify-center gap-2 transition-all">
                    <Plus size={13} /> Add Recipient
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ─── PDF Canvas ─── */}
        <div ref={scrollRef}
          className="flex-1 overflow-auto bg-slate-100/50 dark:bg-neutral-950/50 flex justify-center py-6 px-4"
          onClick={() => setSelId(null)}>
          {pdfImgs.length > 0 ? (
            <div ref={pdfRef} className="relative flex-shrink-0"
              style={{ width: pdfW * scale, height: pdfH * scale }}>
              {/* PDF image */}
              <img src={pdfImgs[pg - 1]} alt="" draggable={false}
                className="absolute inset-0 w-full h-full shadow-2xl rounded-lg"
                style={{ pointerEvents: "none" }} />

              {/* Fields */}
              {pgFields.map(f => {
                const color = recColor(f.recipientId);
                const isSel = f.id === selId;
                const ft = FIELD_DEFS.find(t => t.type === f.type);
                const Icon = ft?.icon || Type;
                const isMoving = drag?.mode === "move" && (drag as any).fid === f.id;

                return (
                  <div key={f.id}
                    className={`absolute group ${isMoving ? "cursor-grabbing" : "cursor-grab"}`}
                    style={{
                      left: f.x * scale,
                      top: f.y * scale,
                      width: f.width * scale,
                      height: f.height * scale,
                      zIndex: isSel ? 20 : 10,
                    }}
                    onMouseDown={e => startMove(e, f)}
                    onClick={e => { e.stopPropagation(); setSelId(f.id); }}>

                    {/* Field body */}
                    <div className="absolute inset-0 rounded-md transition-all duration-100"
                      style={{
                        background: color + "12",
                        border: isSel ? `2px solid ${color}` : `1.5px dashed ${color}80`,
                        boxShadow: isSel ? `0 0 0 3px ${color}20, 0 2px 8px ${color}15` : "none",
                      }} />

                    {/* Label badge */}
                    <div className="absolute left-0 flex items-center gap-1 px-1.5 py-0.5 rounded-md text-white text-[10px] font-semibold whitespace-nowrap pointer-events-none transition-opacity"
                      style={{
                        background: color,
                        top: -22,
                        opacity: isSel ? 1 : 0.85,
                      }}>
                      <Icon size={10} />
                      {ft?.label}{f.required && " *"}
                    </div>

                    {/* Resize handles (selected only) */}
                    {isSel && (
                      <>
                        {(["nw", "ne", "sw", "se"] as const).map(h => (
                          <div key={h}
                            className="absolute w-[10px] h-[10px] rounded-full bg-white border-2 z-30 hover:scale-125 transition-transform"
                            style={{
                              borderColor: color,
                              cursor: h === "nw" || h === "se" ? "nwse-resize" : "nesw-resize",
                              top: h.includes("n") ? -5 : undefined,
                              bottom: h.includes("s") ? -5 : undefined,
                              left: h.includes("w") ? -5 : undefined,
                              right: h.includes("e") ? -5 : undefined,
                            }}
                            onMouseDown={e => startResize(e, f, h)} />
                        ))}
                        {/* Delete button */}
                        <button
                          className="absolute -top-[22px] -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white z-30 shadow-sm transition-colors"
                          onMouseDown={e => {
                            e.stopPropagation(); e.preventDefault();
                            setFields(prev => prev.filter(ff => ff.id !== f.id));
                            setSelId(null);
                          }}>
                          <X size={10} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}

              {/* Click-to-deselect overlay (behind fields) */}
              <div className="absolute inset-0" style={{ zIndex: 0 }} onClick={() => setSelId(null)} />
            </div>
          ) : (
            <div className="flex items-center justify-center text-slate-400 dark:text-neutral-500 flex-1">
              <div className="text-center">
                <div className="w-10 h-10 border-2 border-slate-200 dark:border-neutral-700 border-t-mint-500 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm">Rendering PDF...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Drag ghost (sidebar → PDF) ─── */}
      {drag?.mode === "place-active" && ghost && (
        <div className="fixed pointer-events-none z-[9999]"
          style={{ left: ghost.x - (drag.w * scale) / 2, top: ghost.y - (drag.h * scale) / 2 }}>
          <div className="rounded-lg border-2 border-dashed opacity-70"
            style={{
              width: drag.w * scale,
              height: drag.h * scale,
              borderColor: FIELD_DEFS.find(f => f.type === drag.ftype)?.color,
              background: (FIELD_DEFS.find(f => f.type === drag.ftype)?.color || "#888") + "20",
            }}>
            <div className="absolute -top-5 left-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-white text-[10px] font-semibold whitespace-nowrap"
              style={{ background: FIELD_DEFS.find(f => f.type === drag.ftype)?.color }}>
              {FIELD_DEFS.find(f => f.type === drag.ftype)?.label}
            </div>
          </div>
        </div>
      )}

      {/* ─── Keyboard hint ─── */}
      {selId && !isDragging && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-neutral-900/90 dark:bg-neutral-800/90 text-white/80 text-xs rounded-full backdrop-blur-sm z-50 shadow-lg">
          <span className="font-medium text-white/60">⌫</span> Delete  ·  <span className="font-medium text-white/60">Esc</span> Deselect  ·  Drag corners to resize
        </div>
      )}
    </div>
  );
}
