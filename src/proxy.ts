import { NextResponse, type NextRequest } from "next/server";

/**
 * Security proxy:
 *  1. CSRF origin validation on mutating requests
 *  2. Admin route protection (requires NextAuth session)
 *  3. Dashboard route protection (requires merchant session cookie)
 */

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function getOriginHost(request: NextRequest): string | null {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host;
    } catch {
      return null;
    }
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host;
    } catch {
      return null;
    }
  }
  return null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── CSRF origin check on all mutating API requests ───
  if (pathname.startsWith("/api/") && MUTATING_METHODS.has(request.method)) {
    const requestHost = request.headers.get("host");
    const originHost = getOriginHost(request);

    // If there's an origin/referer, it MUST match the request host
    if (originHost && requestHost && originHost !== requestHost) {
      return NextResponse.json(
        { error: "CSRF validation failed" },
        { status: 403 },
      );
    }
  }

  // ─── Admin route protection ───
  if (pathname.startsWith("/admin")) {
    // NextAuth uses a session token cookie
    const sessionToken =
      request.cookies.get("__Secure-authjs.session-token") ??
      request.cookies.get("authjs.session-token");

    if (!sessionToken?.value) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ─── Dashboard route protection ───
  if (pathname.startsWith("/dashboard")) {
    const merchantSession = request.cookies.get("merchant_session");

    if (!merchantSession?.value) {
      return NextResponse.redirect(new URL("/store", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/api/:path*"],
};
