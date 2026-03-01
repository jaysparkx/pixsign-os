import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/pricing",
  "/sign/",
  "/api/sign/",
  "/share/",
  "/api/auth/",
  "/api/track",
  "/api/webhooks/",
  "/api/documents/", // share sub-route handled below
];

function isPublic(pathname: string): boolean {
  // Static assets & Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/uploads/") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|css|js|woff|woff2)$/)
  ) {
    return true;
  }

  // Exact public paths
  for (const p of PUBLIC_PATHS) {
    if (pathname === p || pathname.startsWith(p)) return true;
  }

  // Share API route is public
  if (pathname.match(/^\/api\/documents\/[^/]+\/share$/)) return true;

  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Security headers on ALL responses
  const headers = new Headers();
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  headers.set(
    "Content-Security-Policy",
    "frame-ancestors 'none'; default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https:; font-src 'self' https:;"
  );

  // Prevent HTML page caching so deploys take effect immediately
  if (!pathname.startsWith("/_next/static") && !pathname.startsWith("/api/")) {
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  }

  // Public routes — pass through with security headers
  if (isPublic(pathname)) {
    const res = NextResponse.next();
    headers.forEach((v, k) => res.headers.set(k, v));
    return res;
  }

  // Check for Better Auth session cookie
  const sessionToken =
    req.cookies.get("better-auth.session_token")?.value ||
    req.cookies.get("__Secure-better-auth.session_token")?.value;

  if (!sessionToken) {
    // API routes: return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: Object.fromEntries(headers.entries()) }
      );
    }
    // Page routes: redirect to login
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    const res = NextResponse.redirect(loginUrl);
    headers.forEach((v, k) => res.headers.set(k, v));
    return res;
  }

  // Authenticated — pass through with security headers
  const res = NextResponse.next();
  headers.forEach((v, k) => res.headers.set(k, v));
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
