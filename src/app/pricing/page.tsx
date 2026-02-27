"use client";

import { useState } from "react";
import { Check, Zap, Building2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const plans = [
  {
    key: "FREE",
    name: "Free",
    price: "$0",
    period: "forever",
    docs: "3 docs/month",
    icon: Sparkles,
    color: "gray",
    features: [
      "3 documents per month",
      "Basic e-signing",
      "Email notifications",
      "PDF download with audit trail",
      "Unlimited signers per document",
    ],
    cta: "Get Started Free",
    popular: false,
  },
  {
    key: "PRO",
    name: "Pro",
    price: "$15",
    period: "/month",
    docs: "50 docs/month",
    icon: Zap,
    color: "blue",
    features: [
      "50 documents per month",
      "Everything in Free",
      "Deal Rooms (multi-doc links)",
      "REST API access",
      "Analytics dashboard",
      "Custom branding & logo",
      "Priority email support",
    ],
    cta: "Start Pro",
    popular: true,
  },
  {
    key: "BUSINESS",
    name: "Business",
    price: "$49",
    period: "/month",
    docs: "Unlimited",
    icon: Building2,
    color: "purple",
    features: [
      "Unlimited documents",
      "Everything in Pro",
      "Webhooks & integrations",
      "SSO (coming soon)",
      "Remove Pixsign branding",
      "Team management",
      "Dedicated account support",
    ],
    cta: "Start Business",
    popular: false,
  },
];

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [annual, setAnnual] = useState(false);

  async function handleSubscribe(plan: string) {
    if (plan === "FREE") return;
    setLoading(plan);
    try {
      // TODO: Replace with actual userId from auth
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "demo-user", plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Something went wrong");
      }
    } catch {
      alert("Failed to start checkout");
    }
    setLoading(null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-6xl mx-auto px-4 py-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            No hidden fees. No per-signature charges. No surprises.
            <br />
            Cancel anytime.
          </p>

          {/* Annual toggle */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <span className={`text-sm ${!annual ? "text-gray-900 font-medium" : "text-gray-500"}`}>
              Monthly
            </span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                annual ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  annual ? "translate-x-7" : ""
                }`}
              />
            </button>
            <span className={`text-sm ${annual ? "text-gray-900 font-medium" : "text-gray-500"}`}>
              Annual
              <span className="ml-1 text-green-600 font-medium text-xs">Save 20%</span>
            </span>
          </div>
        </motion.div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, i) => {
            const price = annual && plan.key !== "FREE"
              ? `$${Math.round(parseInt(plan.price.replace("$", "")) * 0.8)}`
              : plan.price;

            return (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`relative rounded-2xl border-2 p-8 bg-white ${
                  plan.popular
                    ? "border-blue-500 shadow-xl shadow-blue-500/10 scale-[1.02]"
                    : "border-gray-200 hover:border-gray-300"
                } transition-all`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <plan.icon className={`w-8 h-8 mb-3 ${
                    plan.popular ? "text-blue-600" : "text-gray-400"
                  }`} />
                  <h2 className="text-2xl font-bold text-gray-900">{plan.name}</h2>
                  <p className="text-gray-500 text-sm mt-1">{plan.docs}</p>
                </div>

                <div className="mb-8">
                  <span className="text-4xl font-bold text-gray-900">{price}</span>
                  <span className="text-gray-500 text-sm">
                    {plan.period}
                    {annual && plan.key !== "FREE" ? " (billed annually)" : ""}
                  </span>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.key)}
                  disabled={loading === plan.key}
                  className={`w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all ${
                    plan.popular
                      ? "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/25"
                      : plan.key === "FREE"
                      ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      : "bg-gray-900 text-white hover:bg-gray-800"
                  } disabled:opacity-50`}
                >
                  {loading === plan.key ? "Redirecting..." : plan.cta}
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* FAQ / Trust signals */}
        <div className="mt-20 text-center">
          <p className="text-gray-400 text-sm">
            🔒 Secured by Stripe · 256-bit SSL encryption · SOC 2 compliant payments
          </p>
          <p className="text-gray-400 text-xs mt-2">
            VAT may apply based on your location. Prices in USD.
          </p>
        </div>
      </div>
    </div>
  );
}
