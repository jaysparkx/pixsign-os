import { NextRequest, NextResponse } from "next/server";
import { stripe, PLANS } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("⚠️ Stripe webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      // ── Checkout completed ─────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;
        if (userId && plan) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              plan,
              stripeSubId: session.subscription as string,
              stripeCustomerId: session.customer as string,
              stripeSubStatus: "active",
            },
          });
          console.log(`✅ User ${userId} upgraded to ${plan}`);
        }
        break;
      }

      // ── Subscription updated (plan change, renewal) ───────
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;

        const priceId = sub.items.data[0]?.price.id;
        const plan =
          Object.entries(PLANS).find(([_, v]) => v.priceId === priceId)?.[0] || "FREE";

        await prisma.user.update({
          where: { id: userId },
          data: {
            plan,
            stripeSubId: sub.id,
            stripeSubStatus: sub.status,
          },
        });
        console.log(`🔄 User ${userId} subscription updated → ${plan} (${sub.status})`);
        break;
      }

      // ── Subscription canceled ─────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              plan: "FREE",
              stripeSubId: null,
              stripeSubStatus: "canceled",
            },
          });
          console.log(`❌ User ${userId} subscription canceled → FREE`);
        }
        break;
      }

      // ── Invoice paid (renewal success) ────────────────────
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoice.subscription as string;
        if (subId) {
          const user = await prisma.user.findFirst({ where: { stripeSubId: subId } });
          if (user) {
            await prisma.user.update({
              where: { id: user.id },
              data: { stripeSubStatus: "active" },
            });
          }
        }
        break;
      }

      // ── Payment failed ────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoice.subscription as string;
        if (subId) {
          const user = await prisma.user.findFirst({ where: { stripeSubId: subId } });
          if (user) {
            await prisma.user.update({
              where: { id: user.id },
              data: { stripeSubStatus: "past_due" },
            });
            console.warn(`⚠️ Payment failed for user ${user.id} (${user.email})`);
            // TODO: Send warning email to user
          }
        }
        break;
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }
  } catch (error: any) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
