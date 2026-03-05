import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createGrantSchema } from "@agentdrop/shared";
import type { CreateGrantResponse, GrantRecord, AuthContext } from "@agentdrop/shared";
import { withAuth } from "@/lib/auth/middleware";
import { db } from "@/db";
import { files, grants } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { issueGrantToken } from "@/lib/grants";
import { logAudit } from "@/lib/audit";
import { badRequest, notFound, forbidden, internalError } from "@/lib/errors";

export const POST = withAuth(async (req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, auth: AuthContext) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = createGrantSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Validation failed", parsed.error.flatten());
  }

  const { fileId, granteeKeyHash, permissions, ttlSeconds } = parsed.data;

  // Verify the caller owns the file
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

  // Compute expiration
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const grantorType = auth!.type === "human" ? ("human" as const) : ("agent" as const);

  // Insert grant record
  let grantRow: {
    id: string;
    fileId: string;
    grantorId: string;
    grantorType: "human" | "agent";
    granteeKeyHash: string;
    permissions: string[];
    expiresAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
  };
  try {
    const inserted = await db
      .insert(grants)
      .values({
        fileId,
        grantorId: callerId,
        grantorType: grantorType,
        granteeKeyHash,
        permissions,
        expiresAt,
      })
      .returning();
    grantRow = inserted[0]!;
  } catch (err) {
    console.error("Failed to create grant:", err);
    return internalError("Failed to create grant");
  }

  // Create the JWT token
  let token: string;
  try {
    token = await issueGrantToken(
      grantRow.id,
      fileId,
      granteeKeyHash,
      permissions,
      ttlSeconds,
    );
  } catch (err) {
    console.error("Failed to create grant token:", err);
    return internalError("Failed to create grant token");
  }

  // Audit log
  await logAudit(auth!, "grant.create", "grant", grantRow.id, {
    fileId,
    granteeKeyHash,
    permissions,
    ttlSeconds,
  });

  const grantRecord: GrantRecord = {
    id: grantRow.id,
    fileId: grantRow.fileId,
    grantorId: grantRow.grantorId,
    grantorType: grantRow.grantorType,
    granteeKeyHash: grantRow.granteeKeyHash,
    permissions: grantRow.permissions,
    expiresAt: grantRow.expiresAt.toISOString(),
    revokedAt: null,
    createdAt: grantRow.createdAt.toISOString(),
  };

  const response: CreateGrantResponse = { grant: grantRecord, token };
  return NextResponse.json(response, { status: 201 });
});
