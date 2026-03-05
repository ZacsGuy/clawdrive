import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { AuthContext } from "@agentdrop/shared";
import { withAuth } from "@/lib/auth/middleware";
import { db } from "@/db";
import { agentKeys } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { notFound, forbidden } from "@/lib/errors";

export const DELETE = withAuth(async (
  _req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
  auth: AuthContext,
) => {
  if (auth!.type !== "human") {
    return NextResponse.json(
      { error: "This endpoint requires human authentication", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const { id } = await ctx.params;

  // Look up the key, ensuring it is not already revoked
  const key = await db
    .select()
    .from(agentKeys)
    .where(and(eq(agentKeys.id, id), isNull(agentKeys.revokedAt)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!key) {
    return notFound("Agent key not found or already revoked");
  }

  // Verify ownership
  if (key.userId !== auth!.userId) {
    return forbidden("You do not own this key");
  }

  // Revoke the key
  await db
    .update(agentKeys)
    .set({ revokedAt: new Date() })
    .where(eq(agentKeys.id, id));

  await logAudit(auth!, "key.revoke", "agent_key", id, {
    label: key.label,
    keyHash: key.keyHash,
  });

  return NextResponse.json({ revoked: true });
}, { humanOnly: true });
