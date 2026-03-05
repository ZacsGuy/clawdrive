import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js middleware.
 *
 * This middleware runs on every request and can be used for:
 * - CORS headers
 * - Rate limiting hooks
 * - Request logging
 *
 * Authentication is handled per-route by the withAuth() wrapper,
 * not in this global middleware, because each route has different
 * auth requirements (public, human-only, agent-only, etc.).
 */
export function middleware(req: NextRequest) {
  const response = NextResponse.next();

  // Add CORS headers for API routes
  if (req.nextUrl.pathname.startsWith("/api/") || req.nextUrl.pathname.startsWith("/.well-known/")) {
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-AgentDrop-KeyHash, X-AgentDrop-Timestamp, X-AgentDrop-Nonce, X-AgentDrop-Signature",
    );
    response.headers.set("Access-Control-Max-Age", "86400");
  }

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: response.headers,
    });
  }

  return response;
}

export const config = {
  matcher: ["/api/:path*", "/.well-known/:path*"],
};
