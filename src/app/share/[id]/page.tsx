"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { FileText, Clock, Download, ChevronLeft, ChevronRight, AlertTriangle, Pen } from "lucide-react";

export default function ShareView() {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pdfImgs, setPdfImgs] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/documents/${id}/share`)
      .then(r => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then(d => {
        setDoc(d);
        if (d.pdfUrl) { setPdfUrl(d.pdfUrl); }
        else { setError("No PDF available for this document"); setLoading(false); }
      })
      .catch(() => { setError("Document not found or unavailable"); setLoading(false); });
  }, [id]);

  const renderPdf = useCallback(async (url: string) => {
    try {
      setLoading(true);
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
      // Fetch in main thread (includes cookies), then pass ArrayBuffer to pdfjs
      const res = await fetch(url);
      if (!res.ok) throw new Error(`PDF fetch failed: ${res.status}`);
      const data = await res.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      setTotalPages(pdf.numPages);
      const imgs: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const pg = await pdf.getPage(i);
        const vp = pg.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = vp.width; canvas.height = vp.height;
        await pg.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
        imgs.push(canvas.toDataURL());
      }
      setPdfImgs(imgs);
    } catch (e) {
      console.error("PDF render failed:", e);
      setError("Failed to load the PDF. The file may be missing or corrupted.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (pdfUrl) renderPdf(pdfUrl); }, [pdfUrl, renderPdf]);

  if (error) return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 flex items-center justify-center">
      <div className="text-center">
        <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Document Unavailable</h1>
        <p className="text-slate-500 dark:text-neutral-400">{error}</p>
      </div>
    </div>
  );

  if (!doc && loading) return <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-mint-500 border-t-transparent rounded-full animate-spin" /></div>;

  const statusCfg: Record<string, { label: string; color: string; bg: string }> = {
    COMPLETED: { label: "Signed", color: "text-mint-700 dark:text-mint-400", bg: "bg-mint-50 dark:bg-mint-950/40" },
    DRAFT: { label: "Draft", color: "text-slate-600 dark:text-neutral-400", bg: "bg-slate-100 dark:bg-neutral-800" },
  };
  const st = statusCfg[doc?.status] || { label: doc?.status, color: "text-slate-600 dark:text-neutral-400", bg: "bg-slate-100 dark:bg-neutral-800" };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 flex flex-col">
      <header className="border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-6 h-16 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-mint-400 to-mint-600 rounded-xl flex items-center justify-center shadow-md shadow-mint-200 dark:shadow-mint-900/30">
            <Pen size={14} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-800 dark:text-white">{doc?.title}</h1>
            <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-neutral-500">
              <Clock size={10} />{new Date(doc?.createdAt).toLocaleDateString()}
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${st.bg} ${st.color}`}>{st.label}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 disabled:opacity-30 text-slate-500 dark:text-neutral-400 transition-colors"><ChevronLeft size={14} /></button>
              <span className="text-xs text-slate-500 dark:text-neutral-400 font-medium">Page {page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 disabled:opacity-30 text-slate-500 dark:text-neutral-400 transition-colors"><ChevronRight size={14} /></button>
            </div>
          )}
          <a href={`/api/documents/${id}/download`} className="flex items-center gap-1.5 px-4 py-2 bg-mint-500 hover:bg-mint-600 rounded-xl text-sm text-white font-medium transition-colors">
            <Download size={14} /> Download
          </a>
        </div>
      </header>
      <div className="flex-1 overflow-auto flex justify-center py-8 px-4 bg-slate-100/50 dark:bg-neutral-950">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-mint-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : pdfImgs[page - 1] ? (
          <img src={pdfImgs[page - 1]} alt="" className="max-w-3xl w-full h-auto shadow-xl rounded-xl border border-slate-200 dark:border-neutral-800" />
        ) : (
          <div className="flex items-center justify-center h-64 text-slate-400 dark:text-neutral-500 text-sm">Unable to display PDF</div>
        )}
      </div>
      <footer className="h-12 bg-white dark:bg-neutral-900 border-t border-slate-200 dark:border-neutral-800 flex items-center justify-center text-xs text-slate-400 dark:text-neutral-500">
        Shared via <span className="font-semibold text-mint-600 dark:text-mint-400 ml-1">PixSign</span>
      </footer>
    </div>
  );
}
