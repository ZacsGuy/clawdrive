import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { GrantListResponse, GrantRecord, AgentAuth, AuthContext } from "@agentdrop/shared";
import { withAuth } from "@/lib/auth/middleware";
import { db } from "@/db";
import { grants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { unauthorized } from "@/lib/errors";

export const GET = withAuth(async (_req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, auth: AuthContext) => {
  // This endpoint is agent-only: list grants issued TO this agent
  if (!auth || auth.type !== "agent") {
    return unauthorized("This endpoint requires agent authentication");
  }

  const agentAuth = auth as AgentAuth;

  const rows = await db
    .select()
    .from(grants)
    .where(eq(grants.granteeKeyHash, agentAuth.keyHash))
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
