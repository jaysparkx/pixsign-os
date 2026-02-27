import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getPlan } from "@/lib/stripe";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const plan = getPlan(user.plan);
  const now = new Date();
  const resetAt = new Date(user.docsResetAt);

  // Check if month rolled over
  let docsThisMonth = user.docsThisMonth;
  if (now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
    docsThisMonth = 0;
    await prisma.user.update({
      where: { id: userId },
      data: { docsThisMonth: 0, docsResetAt: now },
    });
  }

  return NextResponse.json({
    plan: user.plan,
    planName: plan.name,
    docsUsed: docsThisMonth,
    docsLimit: plan.docsPerMonth === Infinity ? "unlimited" : plan.docsPerMonth,
    subscriptionStatus: user.stripeSubStatus || "none",
    features: plan.features,
  });
}
