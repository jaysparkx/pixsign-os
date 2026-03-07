"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, Key, Plus, Copy, Trash2, Check, Eye, EyeOff,
    Zap, FileText, Send, BarChart3, Search, Shield, Clock,
    Terminal, ExternalLink, ChevronDown, ChevronUp, AlertTriangle,
    RefreshCw, Cpu, Globe
} from "lucide-react";
import toast from "react-hot-toast";

/* ─── Types ─── */
interface ApiKeyData {
    id: string;
    name: string;
    key?: string; // Only on creation
    keyPrefix: string;
    lastUsedAt: string | null;
    expiresAt: string | null;
    revokedAt: string | null;
    createdAt: string;
    _count?: { mcpLogs: number };
}

/* ─── Tool list for display ─── */
const MCP_TOOLS = [
    { name: "list_documents", description: "List all documents with status and signer counts", icon: FileText, color: "#3b82f6" },
    { name: "get_document", description: "Get detailed info about a specific document", icon: Search, color: "#8b5cf6" },
    { name: "send_for_signing", description: "Send a draft document to all recipients for signing", icon: Send, color: "#22c55e" },
    { name: "get_signing_status", description: "Check who has signed, viewed, or is still pending", icon: Eye, color: "#f59e0b" },
    { name: "get_analytics", description: "Get analytics overview: totals, completion rate, activity", icon: BarChart3, color: "#06b6d4" },
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

    useEffect(() => { fetchKeys(); }, []);

    async function fetchKeys() {
        setLoading(true);
        try {
            const res = await fetch("/api/mcp/keys");
            if (!res.ok) { router.push("/login"); return; }
            setKeys(await res.json());
        } catch { toast.error("Failed to load API keys"); }
        finally { setLoading(false); }
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

    function copyToClipboard(text: string, label: string) {
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
            <header className="sticky top-0 z-30 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-neutral-800">
                <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.push("/")} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-400 transition-colors">
                            <ArrowLeft size={18} />
                        </button>
                        <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-200 dark:shadow-violet-900/30">
                            <Cpu size={16} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-slate-800 dark:text-white tracking-tight">Connect MCP</h1>
                            <p className="text-[11px] text-slate-400 dark:text-neutral-500">Model Context Protocol</p>
                        </div>
                    </div>
                    <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener" className="flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400 hover:underline">
                        MCP Docs <ExternalLink size={12} />
                    </a>
                </div>
            </header>

            <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
                {/* ─── Hero ─── */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-8 text-white"
                >
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvc3ZnPg==')] opacity-50" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                            <Zap size={20} className="text-yellow-300" />
                            <span className="text-xs font-medium uppercase tracking-wider text-violet-200">AI-Powered Integration</span>
                        </div>
                        <h2 className="text-2xl font-extrabold mb-2 tracking-tight">Connect any AI agent to PixSign</h2>
                        <p className="text-sm text-violet-100/80 max-w-xl leading-relaxed">
                            MCP (Model Context Protocol) lets AI tools like Claude, Cursor, and Windsurf manage your documents directly.
                            Generate an API key, add the config to your AI tool, and start signing documents with natural language.
                        </p>
                        <div className="flex items-center gap-6 mt-5">
                            <div className="flex items-center gap-2 text-xs text-violet-200">
                                <Shield size={14} /> Secure API keys
                            </div>
                            <div className="flex items-center gap-2 text-xs text-violet-200">
                                <Globe size={14} /> Works with any MCP client
                            </div>
                            <div className="flex items-center gap-2 text-xs text-violet-200">
                                <Zap size={14} /> 5 tools available
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* ─── API Keys ─── */}
                <motion.section
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Key size={16} className="text-violet-500" /> API Keys
                        </h3>
                        <span className="text-xs text-slate-400 dark:text-neutral-500">{activeKeys.length}/5 active</span>
                    </div>

                    {/* Create key */}
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 p-5 mb-4">
                        <div className="flex gap-3">
                            <input
                                value={newKeyName}
                                onChange={(e) => setNewKeyName(e.target.value)}
                                placeholder="Key name (e.g. Claude Desktop)"
                                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-sm text-slate-700 dark:text-neutral-200 placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                            />
                            <button
                                onClick={createKey}
                                disabled={creating || activeKeys.length >= 5}
                                className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium text-white transition-colors"
                            >
                                {creating ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                                Generate Key
                            </button>
                        </div>
                    </div>

                    {/* New key alert */}
                    <AnimatePresence>
                        {showNewKey && newKey?.key && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-4"
                            >
                                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-5">
                                    <div className="flex items-start gap-3 mb-3">
                                        <AlertTriangle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Save your API key now!</p>
                                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">This is the only time you&apos;ll see the full key. Copy it to a safe place.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 rounded-xl border border-amber-200 dark:border-amber-800/30 p-3">
                                        <code className="flex-1 text-xs font-mono text-slate-700 dark:text-neutral-300 break-all">{newKey.key}</code>
                                        <button
                                            onClick={() => { copyToClipboard(newKey.key!, "API key"); }}
                                            className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-800/40 transition-colors flex-shrink-0"
                                        >
                                            {copied === "API key" ? <Check size={14} /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setShowNewKey(false)}
                                        className="mt-3 text-xs text-amber-600 dark:text-amber-400 hover:underline"
                                    >
                                        I&apos;ve saved it — dismiss
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Key list */}
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : activeKeys.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 dark:text-neutral-500 text-sm">
                            No API keys yet. Generate one to get started.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {activeKeys.map((k) => (
                                <div key={k.id} className="bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 px-5 py-3.5 flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
                                            <Key size={14} className="text-violet-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-700 dark:text-neutral-200">{k.name}</p>
                                            <p className="text-xs text-slate-400 dark:text-neutral-500 font-mono">{k.keyPrefix}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right hidden sm:block">
                                            <p className="text-[11px] text-slate-400 dark:text-neutral-500">
                                                {k._count?.mcpLogs || 0} calls
                                            </p>
                                            <p className="text-[10px] text-slate-300 dark:text-neutral-600">
                                                {k.lastUsedAt ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "Never used"}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => revokeKey(k.id)}
                                            className="p-2 rounded-lg text-slate-300 dark:text-neutral-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.section>

                {/* ─── Setup Guide ─── */}
                <motion.section
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <button
                        onClick={() => setExpandedSection(expandedSection === "setup" ? null : "setup")}
                        className="w-full flex items-center justify-between mb-4"
                    >
                        <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Terminal size={16} className="text-violet-500" /> Setup Guide
                        </h3>
                        {expandedSection === "setup" ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </button>

                    <AnimatePresence>
                        {expandedSection === "setup" && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 overflow-hidden">
                                    {/* Config tabs */}
                                    <div className="flex border-b border-slate-200 dark:border-neutral-800">
                                        {[
                                            { key: "claude" as const, label: "Claude Desktop" },
                                            { key: "cursor" as const, label: "Cursor / Windsurf" },
                                            { key: "curl" as const, label: "cURL" },
                                        ].map((tab) => (
                                            <button
                                                key={tab.key}
                                                onClick={() => setConfigTab(tab.key)}
                                                className={`flex-1 py-3 text-xs font-medium transition-colors ${configTab === tab.key
                                                    ? "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/10 border-b-2 border-violet-500"
                                                    : "text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300"
                                                    }`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="p-5">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-xs text-slate-500 dark:text-neutral-400">
                                                {configTab === "claude"
                                                    ? "Add to your Claude Desktop MCP settings (~/.claude.json):"
                                                    : configTab === "cursor"
                                                        ? "Add to your Cursor/Windsurf MCP settings:"
                                                        : "Test the connection with cURL:"}
                                            </p>
                                            <button
                                                onClick={() => copyToClipboard(snippets[configTab], "Config")}
                                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 text-xs text-slate-500 dark:text-neutral-400 hover:bg-violet-100 dark:hover:bg-violet-900/20 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                                            >
                                                {copied === "Config" ? <Check size={12} /> : <Copy size={12} />} Copy
                                            </button>
                                        </div>
                                        <pre className="bg-slate-950 dark:bg-black rounded-xl p-4 overflow-x-auto text-xs font-mono text-green-400 leading-relaxed">
                                            {snippets[configTab]}
                                        </pre>

                                        {/* Steps */}
                                        <div className="mt-5 space-y-3">
                                            <p className="text-xs font-semibold text-slate-600 dark:text-neutral-300 uppercase tracking-wider">Quick Setup</p>
                                            {[
                                                "Generate an API key above",
                                                "Copy the config snippet",
                                                `Paste into your ${configTab === "claude" ? "~/.claude.json" : configTab === "cursor" ? "MCP settings" : "terminal"}`,
                                                configTab === "curl" ? "Run the command to test" : "Restart your AI tool",
                                                configTab !== "curl" ? "Ask your AI: \"List my PixSign documents\"" : null,
                                            ]
                                                .filter(Boolean)
                                                .map((step, i) => (
                                                    <div key={i} className="flex items-start gap-3">
                                                        <span className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                                                            {i + 1}
                                                        </span>
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
                <motion.section
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                        <Zap size={16} className="text-violet-500" /> Available Tools
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {MCP_TOOLS.map((tool) => (
                            <div
                                key={tool.name}
                                className="bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 p-4 hover:border-violet-300 dark:hover:border-violet-700 transition-colors group"
                            >
                                <div className="flex items-start gap-3">
                                    <div
                                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{ backgroundColor: `${tool.color}15` }}
                                    >
                                        <tool.icon size={16} style={{ color: tool.color }} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-700 dark:text-neutral-200 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                                            {tool.name}
                                        </p>
                                        <p className="text-xs text-slate-400 dark:text-neutral-500 mt-0.5 leading-relaxed">
                                            {tool.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.section>

                {/* ─── Example Prompts ─── */}
                <motion.section
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="pb-8"
                >
                    <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                        <Terminal size={16} className="text-violet-500" /> Example AI Prompts
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                            { prompt: "Show me all my pending documents", desc: "Lists documents with SENT/PARTIALLY_SIGNED status" },
                            { prompt: "What's the signing status of the NDA?", desc: "Shows which signers have signed or are pending" },
                            { prompt: "Send the contract to all recipients", desc: "Sends the document and emails signing links" },
                            { prompt: "Give me my signing analytics for this month", desc: "Returns completion rates, totals, and trends" },
                        ].map((ex) => (
                            <div key={ex.prompt} className="bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 p-4">
                                <p className="text-sm font-medium text-violet-600 dark:text-violet-400 mb-1">&ldquo;{ex.prompt}&rdquo;</p>
                                <p className="text-xs text-slate-400 dark:text-neutral-500">{ex.desc}</p>
                            </div>
                        ))}
                    </div>
                </motion.section>
            </div>
        </div>
    );
}
