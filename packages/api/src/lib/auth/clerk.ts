import { verifyToken } from "@clerk/backend";
import type { HumanAuth } from "@agentdrop/shared";

/**
 * Verify a Clerk session token from the Authorization header.
 * Returns a HumanAuth context if valid, or null if the token is absent/invalid.
 */
export async function verifyClerkToken(
  authHeader: string | null,
): Promise<HumanAuth | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  if (!token) {
    return null;
  }

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    if (!payload.sub) {
      return null;
    }

    return {
      type: "human",
      userId: payload.sub,
    };
  } catch {
    return null;
  }
}
