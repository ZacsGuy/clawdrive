import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { AuthContext } from "@agentdrop/shared";
import { withAuth } from "@/lib/auth/middleware";
import { db } from "@/db";
import { agentKeys } from "@/db/schema";
import { eq, isNull } from "drizzle-orm";
import { notFound } from "@/lib/errors";

export const GET = withAuth(async (
  _req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
  _auth: AuthContext | null,
) => {
  const { id } = await ctx.params;

  // Look up the key by ID (no auth needed, but key must not be revoked)
  const key = await db
    .select({ publicKey: agentKeys.publicKey, keyHash: agentKeys.keyHash })
    .from(agentKeys)
    .where(eq(agentKeys.id, id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!key) {
    return notFound("Agent key not found");
  }

  return NextResponse.json({
    publicKey: key.publicKey,
    keyHash: key.keyHash,
  });
}, { allowPublic: true });
