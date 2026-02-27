import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("⚠️  STRIPE_SECRET_KEY not set — billing features disabled");
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
      typescript: true,
    })
  : null;

export const PLANS = {
  FREE: {
    priceId: null,
    docsPerMonth: 3,
    name: "Free",
    price: 0,
    features: [
      "3 documents/month",
      "Basic e-signing",
      "Email notifications",
      "PDF download with audit trail",
    ],
  },
  PRO: {
    priceId: process.env.STRIPE_PRO_PRICE_ID || "price_pro_monthly",
    docsPerMonth: 50,
    name: "Pro",
    price: 15,
    features: [
      "50 documents/month",
      "Everything in Free",
      "Deal Rooms",
      "API access",
      "Analytics dashboard",
      "Custom branding",
      "Priority email support",
    ],
  },
  BUSINESS: {
    priceId: process.env.STRIPE_BIZ_PRICE_ID || "price_biz_monthly",
    docsPerMonth: Infinity,
    name: "Business",
    price: 49,
    features: [
      "Unlimited documents",
      "Everything in Pro",
      "Webhooks & integrations",
      "SSO (coming soon)",
      "Remove Pixsign branding",
      "Dedicated support",
      "Team management",
    ],
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function getPlan(key: string): (typeof PLANS)[PlanKey] {
  return PLANS[key as PlanKey] || PLANS.FREE;
}
