"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, User, Bell, Shield, Palette, Globe, Save, Lock, Sun, Moon, Monitor } from "lucide-react";
import toast from "react-hot-toast";
import { useTheme } from "@/lib/theme";
import { useSession } from "@/lib/auth-client";

const TABS = [
  { key: "profile", label: "Profile", icon: User, comingSoon: false },
  { key: "notifications", label: "Notifications", icon: Bell, comingSoon: true },
  { key: "security", label: "Security", icon: Shield, comingSoon: true },
  { key: "appearance", label: "Appearance", icon: Palette, comingSoon: false },
  { key: "language", label: "Language", icon: Globe, comingSoon: true },
];

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const [tab, setTab] = useState("profile");
  const [displayName, setDisplayName] = useState(session?.user?.name || "");
  const [timezone, setTimezone] = useState("UTC");

  const email = session?.user?.email || "";

  async function handleSave() {
    // TODO: Update user name via Better Auth API when profile update is needed
    toast.success("Settings saved");
  }

  function handleTabClick(key: string) {
    const tabDef = TABS.find(t => t.key === key);
    if (tabDef?.comingSoon) {
      toast("Coming soon!", { icon: "\u{1F6A7}" });
      return;
    }
    setTab(key);
  }

  const themeOptions: { label: string; value: "light" | "dark" | "system"; icon: typeof Sun }[] = [
    { label: "Light", value: "light", icon: Sun },
    { label: "Dark", value: "dark", icon: Moon },
    { label: "System", value: "system", icon: Monitor },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950">
      {/* Header */}
      <header className="h-16 bg-white dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800 flex items-center gap-4 px-6 sticky top-0 z-30">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-slate-800 dark:text-white">Settings</h1>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Settings sidebar */}
          <nav className="w-56 flex-shrink-0 space-y-1">
            {TABS.map(t => (
              <button key={t.key} onClick={() => handleTabClick(t.key)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all relative ${
                  tab === t.key && !t.comingSoon ? "bg-mint-50 dark:bg-mint-950/40 text-mint-700 dark:text-mint-400" : t.comingSoon ? "text-slate-400 dark:text-neutral-600 cursor-default" : "text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-700 dark:hover:text-neutral-200"
                }`}>
                <t.icon size={16} className={tab === t.key && !t.comingSoon ? "text-mint-500" : ""} />
                {t.label}
                {t.comingSoon && <Lock size={10} className="ml-auto text-slate-300 dark:text-neutral-600" />}
              </button>
            ))}
          </nav>

          {/* Settings content */}
          <div className="flex-1">
            {tab === "profile" && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6">
                  <h2 className="text-base font-semibold text-slate-800 dark:text-white mb-5">Profile Information</h2>
                  <div className="flex items-center gap-5 mb-6">
                    <img src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(displayName || "PS")}&backgroundColor=22c55e&textColor=ffffff&fontSize=40`} alt="" className="w-16 h-16 rounded-full" />
                    <div>
                      <button className="px-4 py-2 bg-mint-500 hover:bg-mint-600 text-white text-sm font-medium rounded-xl transition-colors">Change Avatar</button>
                      <p className="text-xs text-slate-400 dark:text-neutral-500 mt-1">JPG, PNG or SVG. Max 2MB.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-600 dark:text-neutral-300 mb-1.5 block">Display Name</label>
                      <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-sm text-slate-700 dark:text-neutral-200 outline-none focus:border-mint-400 focus:ring-2 focus:ring-mint-100 dark:focus:ring-mint-900/30 transition-all" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-600 dark:text-neutral-300 mb-1.5 block">Email</label>
                      <input value={email} disabled
                        className="w-full px-3 py-2.5 bg-slate-100 dark:bg-neutral-800/50 border border-slate-200 dark:border-neutral-700 rounded-xl text-sm text-slate-500 dark:text-neutral-400 outline-none cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-600 dark:text-neutral-300 mb-1.5 block">Timezone</label>
                      <select value={timezone} onChange={e => setTimezone(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-sm text-slate-700 dark:text-neutral-200 outline-none focus:border-mint-400 focus:ring-2 focus:ring-mint-100 dark:focus:ring-mint-900/30 transition-all">
                        <option value="UTC">UTC</option>
                        <option value="EST">Eastern Time</option>
                        <option value="PST">Pacific Time</option>
                        <option value="CET">Central European</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2.5 bg-mint-500 hover:bg-mint-600 text-white rounded-xl text-sm font-medium transition-colors">
                    <Save size={15} /> Save Changes
                  </button>
                </div>
              </motion.div>
            )}

            {tab === "appearance" && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 space-y-5">
                  <h2 className="text-base font-semibold text-slate-800 dark:text-white">Appearance</h2>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-neutral-300 mb-3">Theme</p>
                      <div className="flex gap-3">
                        {themeOptions.map(t => {
                          const isActive = theme === t.value;
                          return (
                            <button key={t.value} onClick={() => { setTheme(t.value); toast.success(`Theme set to ${t.label}`); }}
                              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                                isActive ? "bg-mint-50 dark:bg-mint-950/40 border-mint-400 dark:border-mint-700 text-mint-700 dark:text-mint-400" : "bg-slate-50 dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 text-slate-500 dark:text-neutral-400 hover:border-slate-300 dark:hover:border-neutral-600"
                              }`}>
                              <t.icon size={14} />
                              {t.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-neutral-300 mb-3">Sidebar</p>
                      <div className="flex gap-3">
                        {["Expanded", "Collapsed"].map(opt => (
                          <button key={opt} className="px-5 py-2.5 rounded-xl text-sm font-medium border bg-slate-50 dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 text-slate-500 dark:text-neutral-400 hover:border-slate-300 dark:hover:border-neutral-600 transition-all">{opt}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
