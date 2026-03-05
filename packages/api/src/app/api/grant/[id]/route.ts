import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { AuthContext } from "@agentdrop/shared";
import { withAuth } from "@/lib/auth/middleware";
import { db } from "@/db";
import { grants } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { notFound, forbidden } from "@/lib/errors";

export const DELETE = withAuth(async (
  _req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
  auth: AuthContext,
) => {
  const { id } = await ctx.params;

  // Look up the grant, ensuring it is not already revoked
  const grant = await db
    .select()
    .from(grants)
    .where(and(eq(grants.id, id), isNull(grants.revokedAt)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!grant) {
    return notFound("Grant not found or already revoked");
  }

  // Verify the caller is the grantor
  const callerId = auth!.type === "human" ? auth!.userId : auth!.keyHash;
  if (grant.grantorId !== callerId) {
    return forbidden("You are not the grantor of this grant");
  }

  // Revoke the grant
  await db
    .update(grants)
    .set({ revokedAt: new Date() })
    .where(eq(grants.id, id));

  await logAudit(auth!, "grant.revoke", "grant", id, {
    fileId: grant.fileId,
    granteeKeyHash: grant.granteeKeyHash,
  });

  return NextResponse.json({ revoked: true });
});
