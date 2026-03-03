"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ChevronLeft, ChevronRight, Pen, Type, Upload, X, AlertCircle, Download, Clock, ArrowDown, Navigation } from "lucide-react";
import toast from "react-hot-toast";

function useCountdown(expiresAt: string | null) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number; total: number } | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!expiresAt) return;
    function calc() {
      const diff = new Date(expiresAt!).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 }); router.refresh(); return; }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        total: diff,
      });
    }
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return timeLeft;
}

const SIG_FONTS = [
  { name: "Dancing Script", css: "'Dancing Script', cursive" },
  { name: "Caveat", css: "'Caveat', cursive" },
  { name: "Pacifico", css: "'Pacifico', cursive" },
];

type Mode = "DRAW" | "TYPE" | "UPLOAD";

export default function SignPage() {
  const { docId, token } = useParams<{ docId: string; token: string }>();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pdfImgs, setPdfImgs] = useState<string[]>([]);
  const [pdfW, setPdfW] = useState(612);
  const [pdfH, setPdfH] = useState(792);
  const [scale, setScale] = useState(1);
  const [values, setValues] = useState<Record<string, { value?: string; sigDataUrl?: string }>>({});
  const [activeField, setActiveField] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [consentModal, setConsentModal] = useState(false);
  const [mode, setMode] = useState<Mode>("DRAW");
  const [font, setFont] = useState(SIG_FONTS[0]);
  const [typedSig, setTypedSig] = useState("");
  const [uploadSig, setUploadSig] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const countdown = useCountdown(session?.document?.expiresAt ?? null);

  useEffect(() => {
    fetch(`/api/sign/${docId}/${token}`).then(r => r.json()).then(async data => {
      if (data.alreadySigned) { setAlreadySigned(true); return; }
      if (data.completed) { setDone(true); return; }
      if (data.error) { setError(data.error); return; }
      setSession(data);
      // Pre-fill name/email/date
      const init: typeof values = {};
      for (const f of data.fields) {
        if (f.type === "DATE") init[f.id] = { value: new Date().toISOString().split("T")[0] };
        else if (f.type === "NAME") init[f.id] = { value: data.recipient.name };
        else if (f.type === "EMAIL") init[f.id] = { value: data.recipient.email };
      }
      setValues(init);
      // Render pdf — fetch in main thread (includes cookies), then pass ArrayBuffer to pdfjs
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
      const pdfRes = await fetch(data.document.pdfUrl);
      if (!pdfRes.ok) throw new Error(`PDF fetch failed: ${pdfRes.status}`);
      const pdfData = await pdfRes.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: pdfData }).promise;
      setTotalPages(pdf.numPages);
      const imgs: string[] = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const p = await pdf.getPage(n);
        const vp = p.getViewport({ scale: 2 });
        if (n === 1) { setPdfW(vp.width / 2); setPdfH(vp.height / 2); }
        const c = document.createElement("canvas");
        c.width = vp.width; c.height = vp.height;
        await p.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
        imgs.push(c.toDataURL("image/jpeg", 0.9));
      }
      setPdfImgs(imgs);
    }).catch(() => setError("Failed to load document")).finally(() => setLoading(false));
  }, []);

  /* ─── Highlight / "next field" state ─── */
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const calcScale = () => {
      if (!containerRef.current) return;
      // Cap scale at 1.0 so PDF never exceeds natural size
      setScale(Math.min((containerRef.current.clientWidth - 32) / pdfW, 1.0));
    };
    const obs = new ResizeObserver(calcScale);
    obs.observe(containerRef.current);
    calcScale();
    return () => obs.disconnect();
  }, [pdfW]);

  /* ─── Field completion helper ─── */
  function isFieldComplete(f: any): boolean {
    const val = values[f.id];
    if (!val) return false;
    if (f.type === "SIGNATURE" || f.type === "INITIALS") return !!val.sigDataUrl;
    if (f.type === "CHECKBOX") return val.value === "true";
    return !!val.value && val.value.trim().length > 0;
  }

  /* ─── "Next field" navigation ─── */
  function goToNextField() {
    const unfilled = session.fields.filter((f: any) => f.required && !isFieldComplete(f));
    if (unfilled.length === 0) return;
    const next = unfilled[0];
    // Switch to the page containing this field
    if (next.page !== page) setPage(next.page);
    // Highlight the field briefly
    setHighlightId(next.id);
    setTimeout(() => setHighlightId(null), 2000);
    // If it's a signature field, open the modal
    if (next.type === "SIGNATURE" || next.type === "INITIALS") {
      setTimeout(() => setActiveField(next), 300);
    }
    // Scroll to field position after page switch settles
    setTimeout(() => {
      const el = document.getElementById(`field-${next.id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
  }

  // --- Analytics tracking ---
  useEffect(() => {
    if (!session?.document?.id || !pdfImgs.length) return;
    const docId = session.document.id;
    // Generate or retrieve a session-based visitor ID
    let vid = sessionStorage.getItem("pxs_vid");
    if (!vid) { vid = crypto.randomUUID(); sessionStorage.setItem("pxs_vid", vid); }

    // Fetch visitor location once
    let location = "";
    fetch("https://ipapi.co/json/")
      .then(r => r.json())
      .then(data => { location = `${data.city || "Unknown"}, ${data.country_name || "Unknown"}`; })
      .catch(() => { location = "Unknown"; });

    const pageTimers = new Map<number, number>(); // page -> start timestamp
    const eventQueue: { page: number; durationMs: number; scrollDepth: number }[] = [];

    function startPage(p: number) { if (!pageTimers.has(p)) pageTimers.set(p, Date.now()); }
    function stopPage(p: number) {
      const start = pageTimers.get(p);
      if (start) {
        eventQueue.push({ page: p, durationMs: Date.now() - start, scrollDepth: 1.0 });
        pageTimers.delete(p);
      }
    }

    function flush() {
      // Stop any active timers and queue them
      Array.from(pageTimers.keys()).forEach(p => stopPage(p));
      if (eventQueue.length === 0) return;
      const payload = JSON.stringify({ documentId: docId, visitorId: vid, location, events: eventQueue.splice(0) });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
      } else {
        fetch("/api/track", { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true });
      }
    }

    // Observe page elements becoming visible
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const p = Number(entry.target.getAttribute("data-page"));
        if (isNaN(p)) continue;
        if (entry.isIntersecting) { startPage(p); } else { stopPage(p); }
      }
    }, { threshold: 0.5 });

    // Observe all page containers after a short delay (for DOM to be ready)
    const t = setTimeout(() => {
      document.querySelectorAll("[data-page]").forEach(el => io.observe(el));
    }, 500);

    const flushInterval = setInterval(flush, 5000);
    const handleUnload = () => flush();
    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });

    return () => {
      clearTimeout(t);
      clearInterval(flushInterval);
      window.removeEventListener("beforeunload", handleUnload);
      flush();
      io.disconnect();
    };
  }, [session, pdfImgs]);

  function startDraw(e: React.MouseEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!; const ctx = c.getContext("2d")!;
    const r = c.getBoundingClientRect();
    ctx.beginPath(); ctx.moveTo(e.clientX - r.left, e.clientY - r.top); setDrawing(true);
  }
  function draw(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const c = canvasRef.current!; const ctx = c.getContext("2d")!;
    const r = c.getBoundingClientRect();
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
    ctx.strokeStyle = "#1a1a3a"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.stroke();
  }
  function clearCanvas() {
    const c = canvasRef.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
  }
  function getTypedDataUrl() {
    const c = document.createElement("canvas"); c.width = 400; c.height = 120;
    const ctx = c.getContext("2d")!;
    ctx.font = `64px ${font.css}`; ctx.fillStyle = "#1a1a3a"; ctx.textBaseline = "middle";
    ctx.fillText(typedSig || session?.recipient?.name || "", 20, 60);
    return c.toDataURL("image/png");
  }

  function applySignature() {
    if (!activeField) return;
    let sigDataUrl: string;
    if (mode === "DRAW") {
      const c = canvasRef.current!;
      const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      if (!data.some(v => v !== 0)) { toast.error("Please draw your signature"); return; }
      sigDataUrl = c.toDataURL("image/png");
    } else if (mode === "TYPE") {
      sigDataUrl = getTypedDataUrl();
    } else {
      if (!uploadSig) { toast.error("Upload an image"); return; }
      sigDataUrl = uploadSig;
    }
    setValues(prev => ({ ...prev, [activeField.id]: { sigDataUrl } }));
    setActiveField(null); clearCanvas(); setTypedSig(""); setUploadSig(null);
  }

  async function submit() {
    const required = session.fields.filter((f: any) => f.required);
    const missing = required.filter((f: any) => !values[f.id]);
    if (missing.length) { toast.error(`Complete all required fields (${missing.map((f: any) => f.type).join(", ")})`); return; }
    setConsentModal(true);
  }

  async function doSubmit() {
    setConsentModal(false); setSubmitting(true);
    try {
      const payload = session.fields.map((f: any) => ({ id: f.id, ...values[f.id] }));
      const res = await fetch(`/api/sign/${docId}/${token}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: payload, consent: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.downloadUrl) setDownloadUrl(data.downloadUrl);
      setDone(true);
    } catch (e: any) { toast.error(e.message || "Failed"); }
    setSubmitting(false);
  }

  async function decline() {
    const reason = window.prompt("Reason for declining (optional):"); if (reason === null) return;
    await fetch(`/api/sign/${docId}/${token}/decline`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
    setError("You have declined to sign this document.");
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 flex items-center justify-center">
      <div className="text-center"><div className="w-10 h-10 border-2 border-mint-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" /><p className="text-slate-500 dark:text-neutral-400 text-sm">Loading...</p></div>
    </div>
  );

  if (done) return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-sm">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring" }} className="w-20 h-20 bg-green-600 dark:bg-green-700 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 size={40} className="text-white" /></motion.div>
        <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-3">Signed!</h1>
        <p className="text-slate-500 dark:text-neutral-400 mb-6">Your signature was recorded.{downloadUrl ? " The document is ready for download." : " You'll receive a copy by email once everyone has signed."}</p>
        {downloadUrl && (
          <a href={downloadUrl} className="inline-flex items-center gap-2 px-6 py-3 bg-mint-500 hover:bg-mint-600 text-white rounded-lg text-sm font-semibold transition-all">
            <Download size={16} /> Download Signed Document
          </a>
        )}
      </motion.div>
    </div>
  );

  if (alreadySigned) return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 flex items-center justify-center p-4">
      <div className="text-center"><CheckCircle2 size={48} className="text-green-600 dark:text-green-400 mx-auto mb-4" /><h1 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Already Signed</h1><p className="text-slate-500 dark:text-neutral-400 text-sm">You already signed. You'll get a copy when all parties complete signing.</p></div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 flex items-center justify-center p-4">
      <div className="text-center"><AlertCircle size={48} className="text-red-400 mx-auto mb-4" /><h1 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Unable to Sign</h1><p className="text-slate-500 dark:text-neutral-400 text-sm">{error}</p></div>
    </div>
  );

  if (!session) return null;

  const pageFields = session.fields.filter((f: any) => f.page === page);
  const requiredFields = session.fields.filter((f: any) => f.required);
  const required = requiredFields.length;
  const completed = requiredFields.filter((f: any) => isFieldComplete(f)).length;
  const progress = required > 0 ? (completed / required) * 100 : 100;
  const allComplete = completed === required;
  const unfilled = requiredFields.filter((f: any) => !isFieldComplete(f));
  const remaining = unfilled.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 flex flex-col">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&family=Caveat:wght@600&family=Pacifico&display=swap');`}</style>

      {/* Header */}
      <header className="bg-white dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="w-7 h-7 bg-mint-500 rounded-md flex items-center justify-center flex-shrink-0"><Pen size={13} className="text-white" /></div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-800 dark:text-white truncate">{session.document.title}</div>
          <div className="text-xs text-slate-500 dark:text-neutral-400">Signing as {session.recipient.name}</div>
        </div>
        {countdown && countdown.total > 0 && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${countdown.total < 86400000 ? "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400" :
            countdown.total < 604800000 ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" :
              "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400"
            }`}>
            <Clock size={11} />
            {countdown.days > 0 && `${countdown.days}d `}{String(countdown.hours).padStart(2, "0")}:{String(countdown.minutes).padStart(2, "0")}:{String(countdown.seconds).padStart(2, "0")}
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="w-20 bg-slate-200 dark:bg-neutral-800 rounded-full h-1.5">
            <motion.div animate={{ width: `${progress}%` }} className="bg-mint-500 h-1.5 rounded-full" />
          </div>
          <span className="text-xs text-slate-500 dark:text-neutral-400">{completed}/{required}</span>
        </div>
      </header>

      {/* Expiry FOMO banner */}
      {countdown && countdown.total > 0 && countdown.total < 86400000 && (
        <div className="bg-mint-50 dark:bg-mint-950/50 border-b border-mint-200 dark:border-mint-500/20 px-4 py-2 flex items-center justify-center gap-2 flex-shrink-0">
          <Clock size={13} className="text-mint-600 dark:text-mint-400" />
          <span className="text-xs text-mint-600 dark:text-mint-300 font-medium">
            This document expires in {countdown.hours > 0 ? `${countdown.hours}h ${countdown.minutes}m` : `${countdown.minutes}m ${countdown.seconds}s`}. Please complete your signature.
          </span>
        </div>
      )}

      {session.document.message && (
        <div className="bg-slate-100 border-b border-slate-200 dark:bg-neutral-800 dark:border-neutral-700 px-4 py-2.5">
          <p className="text-sm text-slate-600 dark:text-neutral-300 italic">"{session.document.message}"</p>
        </div>
      )}

      {/* PDF */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-2 bg-white dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800 flex-shrink-0">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded bg-slate-100 disabled:opacity-30 dark:bg-neutral-800"><ChevronLeft size={15} /></button>
          <span className="text-sm text-slate-500 dark:text-neutral-400">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded bg-slate-100 disabled:opacity-30 dark:bg-neutral-800"><ChevronRight size={15} /></button>
        </div>
      )}

      <div ref={containerRef} className="flex-1 overflow-auto bg-slate-50 dark:bg-neutral-950 flex justify-center py-4 px-4">
        {pdfImgs.length > 0 ? (
          <div data-page={page} className="relative" style={{ width: pdfW * scale, height: pdfH * scale }}>
            <img src={pdfImgs[page - 1]} alt="" className="absolute inset-0 w-full h-full shadow-2xl" draggable={false} style={{ pointerEvents: "none" }} />
            {pageFields.map((f: any) => {
              const val = values[f.id];
              const isSigFilled = val?.sigDataUrl;
              const isHL = highlightId === f.id;
              return (
                <div key={f.id} id={`field-${f.id}`} className={`absolute transition-all ${isHL ? "z-20" : ""}`}
                  style={{
                    left: f.x * scale, top: f.y * scale,
                    width: f.width * scale, height: f.height * scale,
                    ...(isHL ? { boxShadow: "0 0 0 3px #22c55e, 0 0 20px rgba(34,197,94,0.3)", borderRadius: 6 } : {}),
                  }}
                  onClick={() => (f.type === "SIGNATURE" || f.type === "INITIALS") && setActiveField(f)}>
                  {/* Pulse animation on highlight */}
                  {isHL && <div className="absolute -inset-1 border-2 border-mint-400 rounded-lg animate-pulse pointer-events-none" />}
                  {(f.type === "SIGNATURE" || f.type === "INITIALS") ? (
                    isSigFilled ? (
                      <img src={val.sigDataUrl} alt="sig" className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center rounded cursor-pointer" style={{ background: "rgba(34,197,94,0.08)", border: "2px dashed #22c55e" }}>
                        <div className="text-center"><Pen size={Math.min(16, f.height * scale * 0.4)} className="text-mint-500 mx-auto" />{f.height * scale > 40 && <div className="text-xs text-mint-500 mt-0.5">{f.type === "INITIALS" ? "Initials" : "Sign here"}</div>}</div>
                      </div>
                    )
                  ) : f.type === "CHECKBOX" ? (
                    <div onClick={() => setValues(prev => ({ ...prev, [f.id]: { value: prev[f.id]?.value === "true" ? "false" : "true" } }))} className="w-full h-full flex items-center justify-center rounded cursor-pointer" style={{ background: val?.value === "true" ? "rgba(24,168,103,0.2)" : "rgba(24,168,103,0.05)", border: `2px solid ${val?.value === "true" ? "#18a867" : "rgba(24,168,103,0.4)"}` }}>
                      {val?.value === "true" && <CheckCircle2 size={Math.min(20, f.height * scale * 0.7)} className="text-green-600 dark:text-green-400" />}
                    </div>
                  ) : (
                    <input type={f.type === "EMAIL" ? "email" : "text"} value={val?.value || ""} onChange={e => setValues(prev => ({ ...prev, [f.id]: { value: e.target.value } }))} placeholder={f.label || f.type} className="w-full h-full px-2 bg-transparent text-slate-800 dark:text-neutral-100 focus:outline-none rounded" style={{ fontSize: Math.min(13, f.height * scale * 0.4), background: "rgba(160,100,255,0.08)", border: "1.5px solid rgba(160,100,255,0.5)" }} />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-slate-400 dark:text-neutral-500">
            <div className="text-center"><div className="w-8 h-8 border-2 border-slate-300 dark:border-neutral-700 border-t-mint-500 rounded-full animate-spin mx-auto mb-3" /><p className="text-sm">Loading PDF...</p></div>
          </div>
        )}
      </div>

      {/* ─── Next Field floating button ─── */}
      {remaining > 0 && (
        <div className="fixed bottom-20 right-4 z-30">
          <button onClick={goToNextField}
            className="flex items-center gap-2 px-4 py-2.5 bg-mint-500 hover:bg-mint-600 text-white rounded-full shadow-xl shadow-mint-500/30 text-sm font-semibold transition-all animate-bounce hover:animate-none">
            <Navigation size={14} />
            {remaining === unfilled.length ? "Start" : "Next"} Field
            <span className="text-mint-200 text-xs">({remaining} left)</span>
          </button>
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex-shrink-0 border-t border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 flex items-center gap-3">
        <button onClick={decline} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-red-500 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-400 dark:hover:text-red-400 rounded-lg text-sm font-medium transition-all">Decline</button>
        <div className="flex-1" />
        <button onClick={submit} disabled={submitting || !allComplete} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${allComplete
            ? "bg-mint-500 hover:bg-mint-600 text-white shadow-sm shadow-mint-200 dark:shadow-mint-900/30"
            : "bg-slate-200 dark:bg-neutral-800 text-slate-400 dark:text-neutral-600 cursor-not-allowed"
          }`}>
          {submitting ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={16} />}
          {submitting ? "Submitting..." : allComplete ? "Complete Signing" : `${remaining} field${remaining !== 1 ? "s" : ""} remaining`}
        </button>
      </div>

      {/* Signature Modal */}
      <AnimatePresence>
        {activeField && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} className="bg-white border border-slate-200 dark:bg-neutral-900 dark:border-neutral-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md">
              <div className="p-4 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 dark:text-white">{activeField.type === "INITIALS" ? "Add Initials" : "Add Signature"}</h3>
                <button onClick={() => setActiveField(null)} className="text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200"><X size={20} /></button>
              </div>
              {/* Tabs */}
              <div className="flex border-b border-slate-200 dark:border-neutral-800">
                {(["DRAW", "TYPE", "UPLOAD"] as Mode[]).map(m => (
                  <button key={m} onClick={() => setMode(m)} className={`flex-1 py-2.5 text-sm font-medium capitalize flex items-center justify-center gap-1.5 transition-colors ${mode === m ? "text-mint-600 border-b-2 border-mint-500 -mb-px dark:text-mint-400" : "text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-300"}`}>
                    {m === "DRAW" && <Pen size={13} />}{m === "TYPE" && <Type size={13} />}{m === "UPLOAD" && <Upload size={13} />}
                    {m[0] + m.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
              <div className="p-4 space-y-3">
                {mode === "DRAW" && (
                  <>
                    <canvas ref={canvasRef} width={420} height={130} className="w-full border border-slate-200 dark:border-neutral-700 rounded-lg bg-white cursor-crosshair" onMouseDown={startDraw} onMouseMove={draw} onMouseUp={() => setDrawing(false)} onMouseLeave={() => setDrawing(false)} style={{ touchAction: "none" }} />
                    <button onClick={clearCanvas} className="text-xs text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-300">Clear</button>
                  </>
                )}
                {mode === "TYPE" && (
                  <>
                    <input value={typedSig} onChange={e => setTypedSig(e.target.value)} placeholder={session.recipient.name} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-2xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-mint-500 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-100 dark:placeholder:text-neutral-500" style={{ fontFamily: font.css }} />
                    <div className="flex gap-2 overflow-x-auto">
                      {SIG_FONTS.map(f => (
                        <button key={f.name} onClick={() => setFont(f)} className={`px-3 py-1.5 rounded-lg text-sm border whitespace-nowrap transition-all ${font.name === f.name ? "border-mint-500 bg-mint-50 text-mint-600 dark:bg-mint-500/10 dark:text-mint-400" : "border-slate-200 text-slate-500 hover:border-slate-400 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-500"}`} style={{ fontFamily: f.css }}>
                          {typedSig || session.recipient.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {mode === "UPLOAD" && (
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-slate-400 bg-slate-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-neutral-500">
                    <Upload size={22} className="text-slate-500 dark:text-neutral-400 mb-2" /><span className="text-sm text-slate-500 dark:text-neutral-400">Upload signature image</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setUploadSig(ev.target?.result as string); r.readAsDataURL(f); }} />
                    {uploadSig && <img src={uploadSig} alt="" className="mt-2 max-h-16 object-contain" />}
                  </label>
                )}
                <div className="p-3 bg-slate-50 dark:bg-neutral-800 rounded-lg"><p className="text-xs text-slate-500 dark:text-neutral-400">By clicking Apply, I agree my electronic signature is legally binding.</p></div>
                <button onClick={applySignature} className="w-full py-3 bg-mint-500 hover:bg-mint-600 text-white rounded-lg font-semibold">Apply Signature</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Consent Modal */}
      <AnimatePresence>
        {consentModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white border border-slate-200 dark:bg-neutral-900 dark:border-neutral-700 rounded-2xl p-6 max-w-sm w-full">
              <h3 className="font-black text-slate-800 dark:text-white text-xl mb-3">Confirm & Sign</h3>
              <p className="text-slate-500 dark:text-neutral-400 text-sm mb-4">By clicking "I Agree & Sign" you confirm:</p>
              {["You've reviewed the document", "Your e-signature is legally binding", "Your signature, IP, and timestamp will be recorded"].map(item => (
                <div key={item} className="flex items-start gap-2 mb-2"><CheckCircle2 size={14} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" /><span className="text-sm text-slate-600 dark:text-neutral-300">{item}</span></div>
              ))}
              <div className="flex gap-3 mt-5">
                <button onClick={() => setConsentModal(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300 rounded-lg text-sm">Review Again</button>
                <button onClick={doSubmit} className="flex-1 py-2.5 bg-mint-500 hover:bg-mint-600 text-white rounded-lg text-sm font-semibold">I Agree & Sign</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
