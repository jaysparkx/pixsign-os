"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CreditCard, ExternalLink, Check, AlertCircle, Crown } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

interface UsageData {
  plan: string;
  planName: string;
  docsUsed: number;
  docsLimit: number | "unlimited";
  subscriptionStatus: string;
  features: string[];
}

export default function BillingPage() {
  const params = useSearchParams();
  const success = params.get("success");
  const updated = params.get("updated");
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // TODO: Replace with actual userId from auth
    fetch("/api/billing/usage?userId=demo-user")
      .then((r) => r.json())
      .then(setUsage)
      .catch(console.error);
  }, []);

  async function openPortal() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "demo-user" }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error || "No billing account found");
    } catch {
      alert("Failed to open billing portal");
    }
    setLoading(false);
  }

  const docsPercent =
    usage && usage.docsLimit !== "unlimited"
      ? Math.min((usage.docsUsed / (usage.docsLimit as number)) * 100, 100)
      : 0;

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      {/* Success banners */}
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3"
        >
          <Check className="w-5 h-5 text-green-600" />
          <span className="text-green-800 font-medium">
            🎉 Subscription activated! You&apos;re all set.
          </span>
        </motion.div>
      )}
      {updated && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center gap-3"
        >
          <Check className="w-5 h-5 text-blue-600" />
          <span className="text-blue-800 font-medium">Plan updated successfully!</span>
        </motion.div>
      )}

      <h1 className="text-3xl font-bold text-gray-900 mb-2">Billing & Subscription</h1>
      <p className="text-gray-500 mb-8">Manage your plan, usage, and payment method.</p>

      {usage ? (
        <div className="space-y-6">
          {/* Current plan card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Crown className={`w-6 h-6 ${usage.plan === "FREE" ? "text-gray-400" : "text-yellow-500"}`} />
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{usage.planName} Plan</h2>
                  <p className="text-sm text-gray-500">
                    {usage.subscriptionStatus === "active"
                      ? "Active subscription"
                      : usage.subscriptionStatus === "past_due"
                      ? "⚠️ Payment past due"
                      : "No active subscription"}
                  </p>
                </div>
              </div>
              {usage.plan === "FREE" ? (
                <Link
                  href="/pricing"
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-blue-700 transition"
                >
                  Upgrade
                </Link>
              ) : (
                <button
                  onClick={openPortal}
                  disabled={loading}
                  className="flex items-center gap-2 bg-gray-100 text-gray-700 px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-200 transition disabled:opacity-50"
                >
                  <CreditCard className="w-4 h-4" />
                  {loading ? "Opening..." : "Manage"}
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Usage bar */}
            <div className="mt-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Documents this month</span>
                <span className="font-medium text-gray-900">
                  {usage.docsUsed} / {usage.docsLimit === "unlimited" ? "∞" : usage.docsLimit}
                </span>
              </div>
              {usage.docsLimit !== "unlimited" && (
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
                      docsPercent >= 90
                        ? "bg-red-500"
                        : docsPercent >= 70
                        ? "bg-yellow-500"
                        : "bg-blue-500"
                    }`}
                    style={{ width: `${docsPercent}%` }}
                  />
                </div>
              )}
              {usage.docsLimit !== "unlimited" && docsPercent >= 80 && (
                <div className="flex items-center gap-2 mt-3 text-sm text-amber-600">
                  <AlertCircle className="w-4 h-4" />
                  <span>
                    Running low on documents.{" "}
                    <Link href="/pricing" className="underline font-medium">
                      Upgrade your plan
                    </Link>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Features list */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Your plan includes</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {usage.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Portal link for paid users */}
          {usage.plan !== "FREE" && (
            <div className="text-center">
              <button
                onClick={openPortal}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                View invoices, update card, or cancel subscription →
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="animate-pulse space-y-4">
          <div className="bg-gray-100 rounded-2xl h-48" />
          <div className="bg-gray-100 rounded-2xl h-32" />
        </div>
      )}
    </div>
  );
}
