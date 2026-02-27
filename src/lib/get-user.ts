import { headers } from "next/headers";
import { auth } from "./auth";
import { NextResponse } from "next/server";

export async function getCurrentUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session?.user ?? null;
}

/**
 * Returns { user } or { error: NextResponse }.
 * Usage: const { user, error } = await requireUser();
 *        if (error) return error;
 */
export async function requireUser(): Promise<
  { user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>; error?: never }
  | { user?: never; error: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user };
}
