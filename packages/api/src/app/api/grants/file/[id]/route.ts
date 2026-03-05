import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { GrantListResponse, GrantRecord, AuthContext } from "@agentdrop/shared";
import { withAuth } from "@/lib/auth/middleware";
import { db } from "@/db";
import { files, grants } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { notFound, forbidden } from "@/lib/errors";

export const GET = withAuth(async (
  _req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
  auth: AuthContext,
) => {
  const { id: fileId } = await ctx.params;

  // Verify the file exists and the caller owns it
  const file = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), isNull(files.deletedAt)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!file) {
    return notFound("File not found");
  }

  const callerId = auth!.type === "human" ? auth!.userId : auth!.keyHash;
  if (file.ownerId !== callerId) {
    return forbidden("You do not own this file");
  }

  // Fetch all grants for this file
  const rows = await db
    .select()
    .from(grants)
    .where(eq(grants.fileId, fileId))
    .orderBy(grants.createdAt);

  const grantRecords: GrantRecord[] = rows.map((row) => ({
    id: row.id,
    fileId: row.fileId,
    grantorId: row.grantorId,
    grantorType: row.grantorType,
    granteeKeyHash: row.granteeKeyHash,
    permissions: row.permissions,
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));

  const response: GrantListResponse = { grants: grantRecords };
  return NextResponse.json(response);
});
