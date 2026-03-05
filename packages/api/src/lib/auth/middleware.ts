import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { AuthContext } from "@agentdrop/shared";
import { verifyClerkToken } from "./clerk";
import { verifyAgentAuth } from "./agent";
import { unauthorized } from "@/lib/errors";

export interface WithAuthOptions {
  /** Allow unauthenticated access (e.g. public key lookup, JWKS) */
  allowPublic?: boolean;
  /** Restrict to human auth only */
  humanOnly?: boolean;
  /** Restrict to agent auth only */
  agentOnly?: boolean;
}

export type AuthenticatedHandler = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
  auth: AuthContext,
) => Promise<NextResponse>;

export type PublicHandler = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
  auth: AuthContext | null,
) => Promise<NextResponse>;

/**
 * Unified auth wrapper for Next.js App Router route handlers.
 *
 * Tries Clerk first (Bearer token), then agent header auth.
 * If `allowPublic` is true, the handler is called with auth=null if neither succeeds.
 * Otherwise, returns 401 if no valid auth is found.
 */
export function withAuth(
  handler: AuthenticatedHandler | PublicHandler,
  options: WithAuthOptions = {},
) {
  return async (
    req: NextRequest,
    ctx: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    let auth: AuthContext | null = null;

    // Try Clerk first
    const authHeader = req.headers.get("authorization");
    auth = await verifyClerkToken(authHeader);

    // If Clerk didn't work, try agent auth
    if (!auth) {
      // Read body for signature verification only for JSON requests.
      // Binary uploads (file content) are not included in the signature.
      let body: string | undefined;
      const ct = req.headers.get("content-type") ?? "";
      const isJson = ct.includes("application/json");
      if (isJson && req.method !== "GET" && req.method !== "HEAD" && req.method !== "DELETE") {
        try {
          body = await req.clone().text();
        } catch {
          body = undefined;
        }
      }

      const url = new URL(req.url);
      auth = await verifyAgentAuth(req.headers, req.method, url.pathname, body);
    }

    // Enforce auth requirements
    if (!auth && !options.allowPublic) {
      return unauthorized();
    }

    if (auth && options.humanOnly && auth.type !== "human") {
      return unauthorized("This endpoint requires human authentication");
    }

    if (auth && options.agentOnly && auth.type !== "agent") {
      return unauthorized("This endpoint requires agent authentication");
    }

    return (handler as PublicHandler)(req, ctx, auth);
  };
}
