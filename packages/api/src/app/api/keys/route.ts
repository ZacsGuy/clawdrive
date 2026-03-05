import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createKeySchema, importPublicKey, hashPublicKey } from "@agentdrop/shared";
import type { CreateKeyResponse, KeyListResponse, AgentKeyRecord, AuthContext } from "@agentdrop/shared";
import { withAuth } from "@/lib/auth/middleware";
import { db } from "@/db";
import { agentKeys } from "@/db/schema";
import { eq, isNull } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { badRequest, internalError } from "@/lib/errors";

export const POST = withAuth(async (req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, auth: AuthContext) => {
  // Human-only endpoint
  if (auth!.type !== "human") {
    return NextResponse.json(
      { error: "This endpoint requires human authentication", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = createKeySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Validation failed", parsed.error.flatten());
  }

  const { label, publicKey: publicKeyStr } = parsed.data;

  // Validate that the public key is a valid JWK
  let publicKeyCrypto: CryptoKey;
  try {
    publicKeyCrypto = await importPublicKey(publicKeyStr);
  } catch {
    return badRequest("Invalid public key: must be a valid Ed25519 JWK");
  }

  // Compute the key hash (JWK thumbprint)
  let keyHash: string;
  try {
    keyHash = await hashPublicKey(publicKeyCrypto);
  } catch {
    return badRequest("Failed to compute key hash");
  }

  // Insert the agent key record
  let keyRow: {
    id: string;
    userId: string;
    label: string;
    publicKey: string;
    keyHash: string;
    createdAt: Date;
    revokedAt: Date | null;
  };
  try {
    const inserted = await db
      .insert(agentKeys)
      .values({
        userId: auth!.userId,
        label,
        publicKey: publicKeyStr,
        keyHash,
      })
      .returning();
    keyRow = inserted[0]!;
  } catch (err) {
    // Check for unique constraint violation on keyHash
    const message = err instanceof Error ? err.message : "";
    if (message.includes("unique") || message.includes("duplicate")) {
      return badRequest("A key with this public key already exists");
    }
    console.error("Failed to create agent key:", err);
    return internalError("Failed to create agent key");
  }

  // Audit log
  await logAudit(auth!, "key.create", "agent_key", keyRow.id, {
    label,
    keyHash,
  });

  const keyRecord: AgentKeyRecord = {
    id: keyRow.id,
    userId: keyRow.userId,
    label: keyRow.label,
    publicKey: keyRow.publicKey,
    keyHash: keyRow.keyHash,
    createdAt: keyRow.createdAt.toISOString(),
    revokedAt: null,
  };

  const response: CreateKeyResponse = { key: keyRecord };
  return NextResponse.json(response, { status: 201 });
}, { humanOnly: true });

export const GET = withAuth(async (_req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, auth: AuthContext) => {
  // Human-only endpoint
  if (auth!.type !== "human") {
    return NextResponse.json(
      { error: "This endpoint requires human authentication", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const rows = await db
    .select()
    .from(agentKeys)
    .where(eq(agentKeys.userId, auth!.userId))
    .orderBy(agentKeys.createdAt);

  const keys: AgentKeyRecord[] = rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    label: row.label,
    publicKey: row.publicKey,
    keyHash: row.keyHash,
    createdAt: row.createdAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
  }));

  const response: KeyListResponse = { keys };
  return NextResponse.json(response);
}, { humanOnly: true });
