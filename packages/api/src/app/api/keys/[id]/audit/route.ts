import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { AuditLogEntry, AuditLogResponse, AuthContext } from "@agentdrop/shared";
import { withAuth } from "@/lib/auth/middleware";
import { db } from "@/db";
import { agentKeys, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, forbidden } from "@/lib/errors";

export const GET = withAuth(async (
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

  // Verify the key exists and belongs to the caller
  const key = await db
    .select()
    .from(agentKeys)
    .where(eq(agentKeys.id, id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!key) {
    return notFound("Agent key not found");
  }

  if (key.userId !== auth!.userId) {
    return forbidden("You do not own this key");
  }

  // Fetch audit log entries for this key
  const rows = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.keyId, id))
    .orderBy(auditLog.timestamp);

  const entries: AuditLogEntry[] = rows.map((row) => ({
    id: row.id,
    keyId: row.keyId ?? "",
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    timestamp: row.timestamp.toISOString(),
    metadata: row.metadata ?? undefined,
  }));

  const response: AuditLogResponse = { entries };
  return NextResponse.json(response);
}, { humanOnly: true });
