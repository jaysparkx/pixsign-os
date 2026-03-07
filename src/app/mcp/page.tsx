"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, Key, Plus, Copy, Trash2, Check, Eye,
    Zap, FileText, Send, BarChart3, Search, Shield, Clock,
    Terminal, ExternalLink, ChevronDown, ChevronUp, AlertTriangle,
    RefreshCw, Plug, Globe, UserPlus, Ban, Download, Upload,
    Activity
} from "lucide-react";
import toast from "react-hot-toast";

/* ─── Types ─── */
interface ApiKeyData {
    id: string;
    name: string;
    key?: string;
    keyPrefix: string;
    lastUsedAt: string | null;
    expiresAt: string | null;
    revokedAt: string | null;
    createdAt: string;
    _count?: { mcpLogs: number };
}

/* ─── Tool list ─── */
const MCP_TOOLS = [
    { name: "list_documents", description: "List all documents with status and signer counts", icon: FileText, color: "#10b981" },
    { name: "get_document", description: "Get detailed info about a specific document", icon: Search, color: "#10b981" },
    { name: "send_for_signing", description: "Send a draft document to all recipients", icon: Send, color: "#10b981" },
    { name: "get_signing_status", description: "Check who has signed, viewed, or pending", icon: Eye, color: "#f59e0b" },
    { name: "get_analytics", description: "Get analytics overview and activity timeline", icon: BarChart3, color: "#06b6d4" },
    { name: "add_recipient", description: "Add a signer or CC to a draft document", icon: UserPlus, color: "#10b981" },
    { name: "void_document", description: "Void a document and stop all signing", icon: Ban, color: "#ef4444" },
    { name: "download_document", description: "Get a download URL for the PDF", icon: Download, color: "#6366f1" },
    { name: "upload_document", description: "Upload a new PDF via base64 encoding", icon: Upload, color: "#f97316" },
    { name: "delete_document", description: "Permanently delete a document", icon: Trash2, color: "#dc2626" },
];

/* ─── Config snippets ─── */
function getConfigSnippets(apiKey: string) {
    const url = typeof window !== "undefined" ? window.location.origin : "https://app.pixsign.io";
    return {
        claude: JSON.stringify({
            mcpServers: {
                pixsign: {
                    type: "http",
                    url: `${url}/api/mcp`,
                    headers: { Authorization: `Bearer ${apiKey}` },
                    description: "PixSign e-signing — manage documents via AI",
                },
            },
        }, null, 2),
        cursor: JSON.stringify({
            mcpServers: {
                pixsign: {
                    type: "http",
                    url: `${url}/api/mcp`,
                    headers: { Authorization: `Bearer ${apiKey}` },
                },
            },
        }, null, 2),
        curl: `curl -X POST ${url}/api/mcp \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
    };
}

/* ─── Component ─── */
export default function MCPPage() {
    const router = useRouter();
    const [keys, setKeys] = useState<ApiKeyData[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newKeyName, setNewKeyName] = useState("");
    const [newKey, setNewKey] = useState<ApiKeyData | null>(null);
    const [showNewKey, setShowNewKey] = useState(false);
    const [copied, setCopied] = useState("");
    const [configTab, setConfigTab] = useState<"claude" | "cursor" | "curl">("claude");
    const [expandedSection, setExpandedSection] = useState<string | null>("setup");
    const [logs, setLogs] = useState<any[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);

    useEffect(() => { fetchKeys(); fetchLogs(); }, []);

    async function fetchKeys() {
        setLoading(true);
        try {
            const res = await fetch("/api/mcp/keys");
            if (!res.ok) { router.push("/login"); return; }
            setKeys(await res.json());
        } catch { toast.error("Failed to load API keys"); }
        finally { setLoading(false); }
    }

    async function fetchLogs() {
        setLogsLoading(true);
        try {
            const res = await fetch("/api/mcp/logs");
            if (res.ok) setLogs(await res.json());
        } catch { /* silent */ }
        finally { setLogsLoading(false); }
    }

    async function createKey() {
        setCreating(true);
        try {
            const res = await fetch("/api/mcp/keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newKeyName || "Default" }),
            });
            if (!res.ok) {
                const e = await res.json();
                toast.error(e.error || "Failed to create key");
                return;
            }
            const data = await res.json();
            setNewKey(data);
            setShowNewKey(true);
            setNewKeyName("");
            fetchKeys();
            toast.success("API key created!");
        } catch { toast.error("Failed to create key"); }
        finally { setCreating(false); }
    }

    async function revokeKey(id: string) {
        if (!confirm("Revoke this API key? This cannot be undone.")) return;
        try {
            await fetch("/api/mcp/keys", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            fetchKeys();
            toast.success("API key revoked");
        } catch { toast.error("Failed to revoke key"); }
    }

    function copyText(text: string, label: string) {
        navigator.clipboard.writeText(text);
        setCopied(label);
        toast.success(`${label} copied!`);
        setTimeout(() => setCopied(""), 2000);
    }

    const activeKeys = keys.filter((k) => !k.revokedAt);
    const snippets = getConfigSnippets(newKey?.key || "pk_your_api_key_here");

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-neutral-950">
            {/* ─── Header ─── */}
            <header className="sticky top-0 z-30 h-16 bg-white dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800 flex items-center px-6 gap-4">
                <button onClick={() => router.push("/")} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-400 transition-colors">
                    <ArrowLeft size={18} />
                </button>
                <div className="w-9 h-9 bg-gradient-to-br from-mint-400 to-mint-600 rounded-xl flex items-center justify-center shadow-md shadow-mint-200 dark:shadow-mint-900/30">
                    <Plug size={16} className="text-white" />
                </div>
                <div className="flex-1">
                    <h1 className="text-sm font-bold text-slate-800 dark:text-white tracking-tight">Connect MCP</h1>
                    <p className="text-[11px] text-slate-400 dark:text-neutral-500">Model Context Protocol</p>
                </div>
                <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener" className="flex items-center gap-1.5 text-xs text-mint-600 dark:text-mint-400 hover:underline">
                    MCP Docs <ExternalLink size={12} />
                </a>
            </header>

            <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
                {/* ─── Hero ─── */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-mint-500 via-emerald-500 to-teal-600 p-8 text-white"
                >
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 30% 50%, rgba(255,255,255,0.15) 0%, transparent 60%)" }} />
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                            <Zap size={18} className="text-yellow-300" />
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-mint-100">AI-Powered Integration</span>
                        </div>
                        <h2 className="text-2xl font-extrabold mb-2 tracking-tight">Connect any AI agent to PixSign</h2>
                        <p className="text-sm text-white/70 max-w-xl leading-relaxed">
                            MCP lets AI tools like Claude, Cursor, and Windsurf manage your documents directly.
                            Generate an API key, add the config, and start signing documents with natural language.
                        </p>
                        <div className="flex items-center gap-6 mt-5">
                            <div className="flex items-center gap-2 text-xs text-white/60"><Shield size={14} /> Secure API keys</div>
                            <div className="flex items-center gap-2 text-xs text-white/60"><Globe size={14} /> Any MCP client</div>
                            <div className="flex items-center gap-2 text-xs text-white/60"><Zap size={14} /> 10 tools</div>
                        </div>
                    </div>
                </motion.div>

                {/* ─── API Keys ─── */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Key size={15} className="text-mint-500" /> API Keys
                        </h3>
                        <span className="text-xs text-slate-400 dark:text-neutral-500">{activeKeys.length}/5 active</span>
                    </div>

                    {/* Create */}
                    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 p-4 mb-3">
                        <div className="flex gap-3">
                            <input
                                value={newKeyName}
                                onChange={(e) => setNewKeyName(e.target.value)}
                                placeholder="Key name (e.g. Claude Desktop)"
                                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-sm text-slate-700 dark:text-neutral-200 placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-mint-500/40"
                            />
                            <button
                                onClick={createKey}
                                disabled={creating || activeKeys.length >= 5}
                                className="flex items-center gap-2 px-5 py-2.5 bg-mint-500 hover:bg-mint-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium text-white transition-colors shadow-sm"
                            >
                                {creating ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                                Generate Key
                            </button>
                        </div>
                    </div>

                    {/* New key alert */}
                    <AnimatePresence>
                        {showNewKey && newKey?.key && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-3">
                                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4">
                                    <div className="flex items-start gap-3 mb-3">
                                        <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Save your API key now!</p>
                                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">This is the only time you&apos;ll see the full key.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 rounded-lg border border-amber-200 dark:border-amber-800/30 p-3">
                                        <code className="flex-1 text-xs font-mono text-slate-700 dark:text-neutral-300 break-all">{newKey.key}</code>
                                        <button onClick={() => copyText(newKey.key!, "API key")} className="p-2 rounded-lg bg-mint-50 dark:bg-mint-900/20 text-mint-600 dark:text-mint-400 hover:bg-mint-100 dark:hover:bg-mint-800/30 transition-colors flex-shrink-0">
                                            {copied === "API key" ? <Check size={14} /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                    <button onClick={() => setShowNewKey(false)} className="mt-2 text-xs text-amber-600 dark:text-amber-400 hover:underline">
                                        I&apos;ve saved it — dismiss
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Key list */}
                    {loading ? (
                        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-mint-500 border-t-transparent rounded-full animate-spin" /></div>
                    ) : activeKeys.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 dark:text-neutral-500 text-sm">No API keys yet. Generate one to get started.</div>
                    ) : (
                        <div className="space-y-2">
                            {activeKeys.map((k) => (
                                <div key={k.id} className="bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 px-4 py-3 flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-mint-50 dark:bg-mint-900/20 flex items-center justify-center">
                                            <Key size={14} className="text-mint-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-700 dark:text-neutral-200">{k.name}</p>
                                            <p className="text-xs text-slate-400 dark:text-neutral-500 font-mono">{k.keyPrefix}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right hidden sm:block">
                                            <p className="text-[11px] text-slate-400 dark:text-neutral-500">{k._count?.mcpLogs || 0} calls</p>
                                            <p className="text-[10px] text-slate-300 dark:text-neutral-600">{k.lastUsedAt ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "Never used"}</p>
                                        </div>
                                        <button onClick={() => revokeKey(k.id)} className="p-2 rounded-lg text-slate-300 dark:text-neutral-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 opacity-0 group-hover:opacity-100 transition-all">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.section>

                {/* ─── Setup Guide ─── */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <button onClick={() => setExpandedSection(expandedSection === "setup" ? null : "setup")} className="w-full flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Terminal size={15} className="text-mint-500" /> Setup Guide
                        </h3>
                        {expandedSection === "setup" ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </button>

                    <AnimatePresence>
                        {expandedSection === "setup" && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                <div className="bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 overflow-hidden">
                                    <div className="flex border-b border-slate-200 dark:border-neutral-800">
                                        {[
                                            { key: "claude" as const, label: "Claude Desktop" },
                                            { key: "cursor" as const, label: "Cursor / Windsurf" },
                                            { key: "curl" as const, label: "cURL" },
                                        ].map((tab) => (
                                            <button key={tab.key} onClick={() => setConfigTab(tab.key)}
                                                className={`flex-1 py-3 text-xs font-medium transition-colors ${configTab === tab.key
                                                    ? "text-mint-600 dark:text-mint-400 bg-mint-50 dark:bg-mint-900/10 border-b-2 border-mint-500"
                                                    : "text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300"
                                                    }`}>
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="p-5">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-xs text-slate-500 dark:text-neutral-400">
                                                {configTab === "claude" ? "Add to your Claude Desktop MCP settings (~/.claude.json):"
                                                    : configTab === "cursor" ? "Add to your Cursor/Windsurf MCP settings:"
                                                        : "Test the connection with cURL:"}
                                            </p>
                                            <button onClick={() => copyText(snippets[configTab], "Config")} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 text-xs text-slate-500 dark:text-neutral-400 hover:bg-mint-50 dark:hover:bg-mint-900/20 hover:text-mint-600 dark:hover:text-mint-400 transition-colors">
                                                {copied === "Config" ? <Check size={12} /> : <Copy size={12} />} Copy
                                            </button>
                                        </div>
                                        <pre className="bg-slate-950 dark:bg-black rounded-xl p-4 overflow-x-auto text-xs font-mono text-green-400 leading-relaxed">
                                            {snippets[configTab]}
                                        </pre>

                                        <div className="mt-5 space-y-3">
                                            <p className="text-[11px] font-semibold text-slate-600 dark:text-neutral-300 uppercase tracking-wider">Quick Setup</p>
                                            {[
                                                "Generate an API key above",
                                                "Copy the config snippet",
                                                `Paste into your ${configTab === "claude" ? "~/.claude.json" : configTab === "cursor" ? "MCP settings" : "terminal"}`,
                                                configTab === "curl" ? "Run the command to test" : "Restart your AI tool",
                                                configTab !== "curl" ? "Ask your AI: \"List my PixSign documents\"" : null,
                                            ].filter(Boolean).map((step, i) => (
                                                <div key={i} className="flex items-start gap-3">
                                                    <span className="w-5 h-5 rounded-full bg-mint-50 dark:bg-mint-900/20 text-mint-600 dark:text-mint-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                                                    <p className="text-sm text-slate-600 dark:text-neutral-400">{step}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.section>

                {/* ─── Available Tools ─── */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                        <Zap size={15} className="text-mint-500" /> Available Tools
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {MCP_TOOLS.map((tool) => (
                            <div key={tool.name} className="bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 p-3.5 hover:border-mint-300 dark:hover:border-mint-700 transition-colors group">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${tool.color}12` }}>
                                        <tool.icon size={15} style={{ color: tool.color }} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-slate-700 dark:text-neutral-200 group-hover:text-mint-600 dark:group-hover:text-mint-400 transition-colors font-mono">{tool.name}</p>
                                        <p className="text-[11px] text-slate-400 dark:text-neutral-500 mt-0.5 leading-relaxed">{tool.description}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.section>

                {/* ─── Example Prompts ─── */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                        <Terminal size={15} className="text-mint-500" /> Example AI Prompts
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {[
                            { prompt: "Show me all my pending documents", desc: "Uses list_documents with SENT filter" },
                            { prompt: "What's the signing status of the NDA?", desc: "Uses get_signing_status for progress" },
                            { prompt: "Send the contract to all recipients", desc: "Uses send_for_signing to email links" },
                            { prompt: "Add john@acme.com as a signer on the lease", desc: "Uses add_recipient on a draft" },
                            { prompt: "Void the expired proposal", desc: "Uses void_document to cancel signing" },
                            { prompt: "Download the signed contract", desc: "Uses download_document for a presigned URL" },
                            { prompt: "Delete all my draft documents", desc: "Uses delete_document with confirm" },
                        ].map((ex) => (
                            <div key={ex.prompt} className="bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 px-4 py-3">
                                <p className="text-sm font-medium text-mint-600 dark:text-mint-400 mb-0.5">&ldquo;{ex.prompt}&rdquo;</p>
                                <p className="text-[11px] text-slate-400 dark:text-neutral-500">{ex.desc}</p>
                            </div>
                        ))}
                    </div>
                </motion.section>

                {/* ─── Activity Log ─── */}
                <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="pb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Activity size={15} className="text-mint-500" /> Activity Log
                        </h3>
                        <button onClick={fetchLogs} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 text-xs text-slate-500 dark:text-neutral-400 hover:bg-mint-50 dark:hover:bg-mint-900/20 hover:text-mint-600 dark:hover:text-mint-400 transition-colors">
                            <RefreshCw size={12} className={logsLoading ? "animate-spin" : ""} /> Refresh
                        </button>
                    </div>

                    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 overflow-hidden">
                        {logsLoading ? (
                            <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-mint-500 border-t-transparent rounded-full animate-spin" /></div>
                        ) : logs.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 dark:text-neutral-500 text-sm">No MCP calls yet. Connect an AI tool to see activity here.</div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-neutral-800">
                                {logs.map((log: any) => (
                                    <div key={log.id} className="px-4 py-3 flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.status === "success" ? "bg-mint-500" : "bg-red-500"}`} />
                                            <div>
                                                <span className="font-mono font-medium text-slate-700 dark:text-neutral-200">{log.tool}</span>
                                                {log.error && <span className="ml-2 text-red-400 dark:text-red-500">{log.error}</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-slate-400 dark:text-neutral-500">
                                            <span className="hidden sm:inline">{log.apiKey?.name || log.apiKey?.keyPrefix}</span>
                                            <span>{log.durationMs}ms</span>
                                            <span>{new Date(log.createdAt).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.section>
            </div>
        </div>
    );
}
