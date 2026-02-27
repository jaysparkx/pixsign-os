import prisma from "@/lib/prisma";
import { getPlan } from "@/lib/stripe";

export async function canCreateDocument(
  userId: string
): Promise<{ allowed: boolean; reason?: string; plan?: string; used?: number; limit?: number }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { allowed: false, reason: "User not found" };

  const plan = getPlan(user.plan);
  const now = new Date();
  const resetAt = new Date(user.docsResetAt);

  // Reset monthly counter on new month
  if (now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
    await prisma.user.update({
      where: { id: userId },
      data: { docsThisMonth: 0, docsResetAt: now },
    });
    return { allowed: true, plan: user.plan, used: 0, limit: plan.docsPerMonth };
  }

  if (plan.docsPerMonth !== Infinity && user.docsThisMonth >= plan.docsPerMonth) {
    return {
      allowed: false,
      reason: `You've used all ${plan.docsPerMonth} documents on your ${plan.name} plan this month. Upgrade to send more.`,
      plan: user.plan,
      used: user.docsThisMonth,
      limit: plan.docsPerMonth,
    };
  }

  return { allowed: true, plan: user.plan, used: user.docsThisMonth, limit: plan.docsPerMonth };
}

export async function incrementDocCount(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { docsThisMonth: { increment: 1 } },
  });
}
